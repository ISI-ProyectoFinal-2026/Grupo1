# QA - Chat en tiempo real (Socket.io ↔ Frontend) - PATITAS

**Fecha de verificación**: 2026-09-02
**Issue**: #141 — [QA] Chat Real-time Integration Testing (consolida #126, cerrada por duplicada)
**Depende de**: #136 (backend chat + notificaciones) y #137 (UI de chat), ambas cerradas
**Alcance**: flujo completo de chat en tiempo real: handshake y autenticación de Socket.io → rooms por chat → envío y recepción de mensajes → persistencia → notificación al receptor → historial por REST → reconexión → punto de entrada al chat desde la UI.
**Estado general**: ✅ Funcional — **4 bugs bloqueantes encontrados y corregidos**, 3 hallazgos documentados

---

## Resumen ejecutivo

Los siete ítems del checklist de la issue pasan. Pero seis de ellos ya estaban cubiertos por las suites que dejó #136, así que limitarse a tildarlos no habría encontrado nada. Lo que sigue salió de atacar el chat por donde las suites existentes no miraban.

El bug más grave es de ordenamiento. Socket.io procesa los eventos de un mismo socket **en paralelo**, y el handler de `send_message` hacía `await` del insert antes de emitir a la room. Con dos envíos rápidos del mismo usuario los handlers se solapaban y emitían en orden de finalización, no de llegada. Verificado con una ráfaga de 30 mensajes: llegaron mezclados, con el mensaje 3 apareciendo entre el 20 y el 21. Y como `created_at` se asigna en el insert, **el orden guardado también quedaba mezclado**: la conversación se reordenaba sola al recargar la página.

El segundo es de seguridad. `imageUrl` se validaba con `z.string().url()`, que acepta `javascript:`, `data:text/html`, `vbscript:` y `file:`. Ese valor lo escribe el otro participante del chat y el frontend lo mete en un `<a href>` y un `<img src>`.

El tercero rompía el criterio de aceptación principal de la issue: **no había forma de iniciar un chat desde la app**. `createChat()` estaba en el frontend pero no lo llamaba nadie, y el detalle del reporte no tenía botón de contacto. Sólo se podía chatear si el chat ya existía en la base.

Y el cuarto: con la sesión vencida, la UI mostraba "Reconectando…" para siempre sin que nada reconectara.

Como daño colateral útil, la suite del backend estaba corriendo **a la mitad en local**: 12 de 21 suites morían al importar `src/app.ts` porque Jest no lee el `.env`. Nadie lo notaba porque `jest` termina con código 0 y CI sí define las variables. Eran 129 tests que en local no se ejecutaban.

---

## 1. Checklist de la issue

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 1 | Socket.io server conecta correctamente | ✅ | `initChatSocket` monta sobre el mismo `httpServer` que Express (`src/index.ts`). Handshake verificado con token en `auth`, header `Authorization` y `query` (sección 3) |
| 2 | Frontend se conecta sin errores | ✅ | Proxy de `/socket.io` con `ws: true` en `vite.config.ts`. Build y lint limpios. Protocolo manual en la sección 6 |
| 3 | Enviar mensaje aparece en tiempo real | ✅ | El emisor recibe el mensaje por el ack y por la room; `appendMessage` deduplica por id |
| 4 | Recibir mensaje del otro usuario funciona | ✅ | Cubierto por `chat.socket.test.ts` y ampliado con la ráfaga de 30 (sección 3) |
| 5 | Historial carga correctamente | ✅ **post-fix** | Orden ascendente verificado con 153 mensajes. El orden estaba roto antes del arreglo de la sección 2.1 |
| 6 | Desconexión / reconexión maneja bien | ✅ **post-fix** | Dos tests nuevos de reconexión (sección 3). El estado de sesión vencida estaba roto, ver 2.3 |
| 7 | Sin memory leaks en listeners | ✅ | 50 ciclos de conexión/desconexión: sockets, rooms y listeners vuelven a la línea base (sección 3) |

| Criterio de aceptación | Estado |
|---|---|
| Flujo chat sincronizado | ✅ **post-fix** — no era alcanzable sin el punto de entrada, ver 2.4 |
| Sin errores en consola | ✅ — `tsc` y `oxlint` limpios en front y back, `npm run build` OK |
| Memory profile limpio | ✅ — sección 3, bloque "listeners y rooms" |
| Performance aceptable | ✅ — sección 4 |

---

## 2. Hallazgos

### 2.1 [BUG] Los mensajes se desordenaban bajo ráfaga — Severidad: **CRÍTICA** — ✅ Corregido

Socket.io no espera a que termine un handler para arrancar el siguiente evento del mismo socket. El handler de `send_message` en `backend/src/sockets/chat.socket.ts` era `async` y hacía dos `await` (el insert del mensaje y la notificación) **antes** de `io.to(room).emit(...)`. Con envíos solapados, el orden de emisión pasaba a ser el de finalización de esos `await`.

Reproducido con una ráfaga de 30 mensajes numerados, emitidos sin esperar el ack anterior:

```
esperado: ...-019, -020, -021, -022, -023, -024, ...
recibido: ...-021, -000, -023, -012, -024, -022, -007, -017, -005, ...
```

Hay dos efectos, y el segundo es peor que el primero:

1. El receptor los ve desordenados en el momento, porque `appendMessage` en `useChatSocket.ts` appendea al final del array sin reordenar.
2. `created_at` tiene `@default(now())` y se asigna **en el insert**, así que el orden persistido queda mezclado igual. El historial se sirve `orderBy: { createdAt: "asc" }`, o sea que al recargar la página la conversación aparece en un orden distinto del que se vio recién. Los mensajes se mueven solos.

**Fix**: los envíos de cada socket se encadenan en una promesa (`pendingSends`), de modo que los mensajes de un mismo emisor se persisten y se emiten en el orden en que los mandó. El orden entre emisores distintos sigue siendo el de llegada al server, que es lo correcto. El handler se extrajo a `handleSendMessage`, que nunca rechaza: cualquier error se devuelve por el ack y por el evento `error`, para que un mensaje inválido no corte la cadena de envíos del socket.

Regresión guardada por el test `una ráfaga de 30 mensajes sin esperar ack llega completa y en orden`. Verificado que falla si se revierte el encadenado.

### 2.2 [BUG] `imageUrl` aceptaba `javascript:` y `data:text/html` — Severidad: **Alta** — ✅ Corregido

`chats.validator.ts` y `chat-socket.validator.ts` validaban `imageUrl` con `z.string().url()`. Ese validador delega en el parser de URL de la plataforma, que acepta cualquier esquema sintácticamente válido. Comprobado contra zod 4.4.3, la versión que usa el proyecto:

```
ACEPTA   javascript:alert(1)
ACEPTA   data:text/html;base64,PHNjcmlwdD4=
ACEPTA   vbscript:msgbox(1)
ACEPTA   file:///etc/passwd
```

No es un campo interno: `imageUrl` lo manda el otro participante del chat, se persiste, y `MessageBubble.tsx` lo renderiza en un `<a href>` y un `<img src>`. Las defensas de React contra `javascript:` en `href` cubren parte del riesgo, pero no todos los esquemas —`data:text/html` no está entre ellos— y de todos modos dependen de la versión del renderer. La validación no puede delegarse en eso: el valor no debería llegar a persistirse.

**Fix**: nuevo `safeHttpUrlSchema` en `backend/src/validators/shared.validator.ts`, que además de `url()` exige que el protocolo sea `http:` o `https:`. Aplicado en los dos validadores de chat. Son los únicos dos usos de `.url()` en todo `src/validators/`, así que la clase queda cerrada. Cubierto por 8 tests (4 esquemas × REST y socket) que además verifican que **no se persiste** el mensaje rechazado, y 1 test que confirma que una URL `https` legítima sigue pasando.

### 2.3 [BUG] Sesión vencida = "Reconectando…" eterno — Severidad: **Media** — ✅ Corregido

`useChatSocket.ts` configura `reconnectionAttempts: Infinity`, y su `handleConnectError` ponía el estado en `'reconnecting'` para cualquier error de conexión. Pero cuando el rechazo viene del middleware de auth del server, socket.io-client hace `destroy()` de sus subscripciones y **no reintenta nunca**. Verificado en el fuente de la librería (`Socket#onpacket`, caso `CONNECT_ERROR`), con el comentario literal *"clean subscriptions to avoid reconnections"*.

O sea: dejás la pestaña abierta, vence el JWT, y el chat queda con el puntito ámbar diciendo "Reconectando…" indefinidamente mientras no hay ningún reintento en curso. El usuario no se entera de que tiene que volver a loguearse. La asimetría es notoria: el cliente REST sí tiene un interceptor de 401 que desloguea y redirige (`services/api.ts`), pero el camino del socket no tenía equivalente.

**Fix**: `handleConnectError` distingue el caso terminal mirando `socket.active`, que es exactamente el flag que separa un rechazo de handshake de una caída de red recuperable. Se agregó el estado `'unauthorized'` a `ChatConnectionStatus`; `ChatWindow` lo muestra en rojo como "Sesión expirada", reemplaza el compositor por un mensaje explicativo y ofrece un link a `/login`.

No se agregó un logout automático a propósito: redirigir al usuario sin que haya tocado nada es más invasivo de lo que corresponde a este arreglo, y si escribe un mensaje el fallback REST devuelve 401 y el interceptor lo desloguea igual.

### 2.4 [BUG] No había forma de iniciar un chat desde la app — Severidad: **Alta** — ✅ Corregido

`createChat()` existía en `frontend/src/services/chats.service.ts` pero **no lo llamaba nadie**. `ReportDetailPage.tsx` no tenía ninguna referencia a chat, y `ChatList` sólo lista conversaciones que ya existen. En una instalación limpia, la tabla `chats` arranca vacía y no hay ninguna acción de usuario que la llene: el chat era inalcanzable salvo insertando a mano en la base.

Esto no es un detalle cosmético: el criterio de aceptación "flujo chat sincronizado" de esta misma issue **no se podía cumplir**.

**Fix**: botón "Contactar al autor" en el detalle del reporte, visible sólo cuando el reporte es de otro usuario. Crea el chat y navega a `/chats/:id`.

Un detalle del contrato del backend obligó a manejar un caso extra: si ya existe un chat con ese participante, `POST /api/chats` responde 409 **sin devolver el chat existente**, así que el frontend se quedaba sin el id y no podía abrirlo. Se resuelve recuperándolo de `listChats()` en el catch. Es un workaround del cliente; la solución de fondo es que el endpoint tenga semántica de *get-or-create*, y eso se propone en 2.6.

### 2.5 [BUG] La suite del backend corría a la mitad en local — Severidad: **Media** — ✅ Corregido

`npm test` en local levantaba 12 de 21 suites caídas con `JWT_SECRET no está definida`. La causa: `src/app.ts` valida esa variable en el import, y Jest no carga el `.env` por su cuenta. En CI no se ve porque el workflow define las variables como `env:` del job.

El efecto real: en local se ejecutaban **112 tests de 241**. Los 129 restantes no corrían y nadie lo notaba, porque Jest igual termina con código 0 y el resumen dice "12 failed" en una línea fácil de pasar por alto.

**Fix**: `setupFiles: ["dotenv/config"]` en `jest.config.js`. `dotenv` no pisa variables ya presentes en `process.env`, así que CI sigue usando las suyas y el pipeline no cambia de comportamiento.

> Nota de entorno, no del repo: el `.env` local usado en esta verificación no tenía `JWT_SECRET`, `FRONTEND_URL` ni `INTERNAL_API_KEY`. Las tres están documentadas en `backend/.env.example`; el archivo local había quedado desactualizado. Si `npm test` sigue fallando después de este fix, comparar el `.env` contra el `.env.example`.

### 2.6 [HALLAZGO] Dos usuarios pueden tener un solo chat, para siempre — Severidad: Media — ⚠️ Documentado, requiere decisión del equipo

`schema.prisma` declara `@@unique([userAId, userBId])` en `Chat`, y `createChat()` busca un chat existente **por par de usuarios, ignorando `reportId`**. Consecuencias:

- Si vos y yo ya hablamos por el reporte #10, no podemos abrir un chat por el #20: responde 409.
- La notificación de mensaje nuevo usa `chat.reportId` (`notifyNewMessage`), así que todos los mensajes futuros apuntan al reporte viejo.
- El modelo tiene `reportId` y `ChatList` lo muestra ("Reporte #N"), lo que sugiere que la intención era un chat por reporte. La implementación es un chat por par de personas.

Además el índice es **direccional**: cubre `(A,B)` pero no `(B,A)`. El guard de `findFirst` en el servicio sí contempla los dos órdenes, pero no es atómico, así que dos `POST /api/chats` simultáneos en orden invertido pueden crear dos chats para el mismo par. Probabilidad baja, pero el índice no lo impide.

No se modificó. Cambiar la unicidad a `(userAId, userBId, reportId)` implica migración y es una decisión de producto, no de QA: hay que definir si el chat es "por reporte" o "por persona". Se sugiere abrir una issue con esa decisión y, de paso, cambiar `POST /api/chats` a semántica get-or-create, lo que también elimina el workaround de 2.4.

### 2.7 [HALLAZGO] El historial no tiene paginación — Severidad: Baja — ⚠️ Documentado

`getMessages` hace `findMany` sin `take` ni cursor: devuelve la conversación entera en cada apertura del chat, y `ChatWindow` renderiza un `MessageBubble` por mensaje. Medido contra el server real (sección 4), a la escala que pide la issue no es un problema; a escalas mayores degrada de forma lineal y previsible. Queda como deuda conocida, no como bloqueante.

### 2.8 [HALLAZGO] El frontend no tiene runner de tests — Severidad: Baja — ⚠️ Fuera de alcance

No hay `vitest` ni `jest` en `frontend/package.json`. Los ítems 2 y 7 del checklist (conexión del frontend y ausencia de leaks en los listeners del hook) sólo se pudieron verificar por lectura de código y por el protocolo manual de la sección 6. La limpieza de `useChatSocket` se revisó a mano y es correcta: quita los cinco listeners uno por uno, desconecta el socket y resetea las refs.

Montar el runner es exactamente el alcance de la **issue #151**, que está abierta. No se tocó para no pisarla.

---

## 3. Suite automatizada

| Comando | Antes | Después |
|---|---|---|
| `npm test` (backend) | 12 suites caídas, 112 tests corriendo | ✅ **22 suites, 257 tests, todo en verde** |
| `npm run typecheck` (backend) | ✅ | ✅ |
| `npx tsc -b` (frontend) | ✅ | ✅ |
| `npm run build` (frontend) | ✅ | ✅ |
| `npx oxlint src` (frontend) | ✅ | ✅ |

Los 16 tests nuevos están en `backend/tests/chats/chat-realtime.test.ts`, en un archivo aparte y autocontenido para que la revisión de esta issue sea fácil de acotar. Los casos de camino feliz ya cubiertos por `chat.socket.test.ts` y `chats.routes.test.ts` no se duplicaron.

**Esquema de `imageUrl`** (9 tests)
- 4 esquemas peligrosos rechazados por socket, verificando además que no se persiste nada.
- Los mismos 4 rechazados por `POST /api/chats/:id/messages` con 400.
- Una URL `https` legítima sigue pasando.

**Reconexión** (2 tests)
- Caída de transporte (`engine.close()`, sin `disconnect()` explícito): el cliente vuelve solo, se re-suscribe con `join_chat` y recibe mensajes de nuevo. Documenta el punto no obvio: al reconectar el socket es nuevo y **las rooms del anterior se perdieron**, por eso `useChatSocket` re-emite `join_chat` cuando el estado vuelve a `connected`.
- Los mensajes enviados mientras el receptor estaba caído se recuperan por REST, que es lo que hace el hook invalidando la query al reconectar. El socket no reenvía lo perdido.

**Listeners y rooms** (3 tests)
- 50 ciclos de conexión, `join_chat` y desconexión: `io.sockets.sockets.size` vuelve a 0 y el mapa de rooms vuelve al tamaño inicial.
- `leave_chat` borra la room al salir el último socket.
- 10 ciclos de conexión/desconexión no acumulan listeners en `io.sockets`.

**Carga e integridad** (2 tests)
- Historial de 153 mensajes: se sirve completo, ordenado ascendente por fecha, en menos de 2s.
- Ráfaga de 30 mensajes sin esperar ack: llegan los 30 y en orden. Este es el que guarda la regresión de 2.1.

---

## 4. Performance

Medido contra el server real levantado sobre `app`, con la base de desarrollo. Dos corridas por escalón, se reporta la segunda (la primera calienta el pool de conexiones).

| Mensajes en el chat | `GET /api/chats/:id/messages` | Payload |
|---|---|---|
| 100 | 14 ms | 15 KB |
| 500 | 14 ms | 78 KB |
| 1.000 | 29 ms | 156 KB |
| 5.000 | 86 ms | 785 KB |

La issue pide validar la carga de 100+ mensajes: **14 ms y 15 KB**, con muchísimo margen. El endpoint escala de forma lineal y previsible; el server no es el cuello de botella. Lo que crece incómodo es el payload, que a 5.000 mensajes son 785 KB en cada apertura del chat, más 5.000 nodos en el DOM. Es el argumento concreto para la paginación de 2.7, cuando haga falta.

---

## 5. Cómo reproducir la verificación automatizada

```bash
# 1. Postgres arriba (puerto 5433 en el host, ver docker/ENV_VARS.md)
docker-compose up -d

# 2. Backend: dependencias, cliente de Prisma y migraciones
cd backend
npm install --legacy-peer-deps
npx prisma generate
npx prisma migrate deploy

# 3. Suite completa
npm test

# 4. Sólo lo de esta issue
npx jest tests/chats/chat-realtime.test.ts --runInBand
```

Si aparece `JWT_SECRET no está definida`, el `.env` local está incompleto: compararlo contra `backend/.env.example`.

---

## 6. Protocolo de verificación manual (2 usuarios, 2 navegadores)

Lo que no se puede automatizar sin el runner de la #151. Requiere backend (`npm run dev` en `backend/`) y frontend (`npm run dev` en `frontend/`) levantados.

**Preparación**: registrar dos usuarios distintos. Abrir uno en una ventana normal y el otro en una ventana de incógnito (no dos pestañas: comparten `localStorage` y la sesión de Zustand se pisa).

| # | Paso | Resultado esperado |
|---|---|---|
| 1 | Usuario A crea un reporte y lo publica | El reporte aparece en el feed |
| 2 | Usuario B abre el detalle de ese reporte | Se ve el botón **"Contactar al autor"** |
| 3 | B toca el botón | Navega a `/chats/:id`, puntito verde, "En línea" |
| 4 | A entra a "Chats" y abre la conversación | Ve el chat con B en la lista |
| 5 | B escribe un mensaje y lo envía | Aparece en lo de B al instante **y en lo de A sin recargar** |
| 6 | A responde | Aparece en ambas ventanas |
| 7 | B manda 5 mensajes seguidos lo más rápido posible | Llegan los 5 **en el mismo orden** en la ventana de A |
| 8 | A recarga la página (F5) | El historial completo se ve **en el mismo orden** que antes de recargar |
| 9 | B adjunta una imagen con 📎 | Se sube a R2 y se ve en ambas ventanas |
| 10 | Cortar la red de B (DevTools → Network → Offline) | El puntito pasa a ámbar, "Reconectando…" |
| 11 | Mientras B está offline, A manda un mensaje | B no lo ve todavía |
| 12 | Restaurar la red de B | Vuelve a "En línea" y **aparece el mensaje que se perdió** |
| 13 | En DevTools de B, borrar `patitas-auth` de localStorage y recargar | Redirige a `/login` |
| 14 | Con la sesión vencida (esperar el `JWT_EXPIRY` o firmar un token corto) | Puntito **rojo**, "Sesión expirada" y link a iniciar sesión. **No** debe quedar en "Reconectando…" |
| 15 | Durante todo el recorrido, mirar la consola del navegador | Sin errores |

Los pasos 7, 8 y 14 son los que ejercitan los bugs corregidos en 2.1 y 2.3. El paso 2 es el de 2.4.

---

## 7. Archivos tocados

**Backend**
- `src/sockets/chat.socket.ts` — encadenado de envíos por socket, handler extraído a `handleSendMessage` (2.1)
- `src/validators/shared.validator.ts` — nuevo, `safeHttpUrlSchema` (2.2)
- `src/validators/chats.validator.ts`, `src/validators/chat-socket.validator.ts` — usan el validador seguro (2.2)
- `jest.config.js` — `setupFiles: ["dotenv/config"]` (2.5)
- `tests/chats/chat-realtime.test.ts` — nuevo, 16 tests

**Frontend**
- `src/hooks/useChatSocket.ts` — distingue el rechazo de handshake por `socket.active` (2.3)
- `src/types/chat.types.ts` — estado `unauthorized` (2.3)
- `src/components/chat/ChatWindow.tsx` — UI de sesión expirada (2.3)
- `src/pages/reports/ReportDetailPage.tsx` — botón "Contactar al autor" (2.4)

---

## 8. Recomendación

El chat queda apto para producción en el alcance de esta issue. Quedan dos cosas para el backlog, ninguna bloqueante:

1. **Decidir el modelo de unicidad del chat** (2.6): ¿por reporte o por persona? De ahí sale la migración y el cambio de `POST /api/chats` a get-or-create, que además saca el workaround de 2.4.
2. **Paginar el historial** (2.7) cuando las conversaciones reales pasen el millar de mensajes. Hoy no hace falta.

Y una dependencia externa: la **#149** (UI de notificaciones) sigue abierta. Hoy `notifyNewMessage` crea la notificación en la base correctamente en los dos caminos de envío —verificado por tests—, pero el usuario no tiene dónde verla. Mientras eso no exista, **sólo te enterás de un mensaje nuevo si tenés el chat abierto**. No es un defecto del chat, es alcance de la #149, pero conviene tenerlo claro antes de decir que el circuito de mensajería está completo.
