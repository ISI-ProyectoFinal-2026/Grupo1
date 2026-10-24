# Issue drafts — informe-final

Drafts only. Issues are created on GitHub after the user approves them. Labels follow the repo convention (`type:`, `epic:`, `priority:`, `area:`).

---

## [CHORE] Test de contrato de esquema entre Prisma y backend-ia

- **Origen:** entrevista C04 (2026-10-22).
- **Labels sugeridos:** `type: chore`, `epic: infra`, `priority: low`, `area: backend`
- **Descripción:** Prisma es el único dueño del esquema (`backend/prisma/schema.prisma`, 14 migraciones). El backend IA mapea un subconjunto de columnas con SQLAlchemy (`backend-ia/app/models.py`: `reports` y `report_embeddings`) sin generar migraciones, y escribe `report_matches` con SQL crudo. Hoy ambos coinciden, pero nada verifica automáticamente que el espejo siga sincronizado: un cambio de nombre o tipo de columna en Prisma rompería el backend IA recién en ejecución. `backend-ia/tests/test_db_connection.py` solo verifica que las tablas existan.
- **Propuesta:** agregar al job `backend-ia` del CI un test que, sobre la base migrada por Prisma, compare cada columna mapeada en `models.py` (y las usadas por SQL crudo en `matching_service.py`) contra `information_schema.columns` (nombre y tipo compatible).
- **Criterio de aceptación:** el CI falla si una columna mapeada por backend-ia no existe o cambió de tipo en la base migrada.

---

## [BUG] La inferencia de embeddings bloquea el event loop de FastAPI

- **Origen:** recolección de evidencia para C05 (2026-10-22).
- **Labels sugeridos:** `type: bug`, `epic: infra`, `priority: medium`, `area: backend`
- **Descripción:** `backend-ia/app/services/embedding_service.py` (`process_report_image`, `async def`) invoca `detect_and_crop` y `generate_embedding` de forma síncrona. Esas llamadas son inferencia intensiva en CPU (~0,68 s por imagen según `docs/QA_IA_PIPELINE.md`) y bloquean el event loop mientras duran: las demás requests concurrentes (`/health`, `/images/analyze`, otros embeddings) quedan en espera. `backend-ia/app/services/image_analysis_service.py` ya resuelve el mismo caso con `asyncio.to_thread`.
- **Propuesta:** ejecutar la inferencia de `process_report_image` con `asyncio.to_thread` (mismo patrón que `image_analysis_service`) y cubrirlo con un test.
- **Criterio de aceptación:** durante el procesamiento de un embedding, `/health` responde sin esperar a que termine la inferencia.
- **Relación:** el test de carga (#40) haría visible el problema.

---

## [REFACTOR] Mover el JWT de localStorage a una cookie httpOnly

- **Origen:** entrevista C07 (2026-10-22); auditoría `docs/AUDITORIA_INTEGRAL_BACKEND_2026-09-23.md` sec. G.
- **Labels sugeridos:** `type: refactor`, `epic: seguridad`, `priority: low`, `area: frontend`, `area: backend`
- **Descripción:** El token de sesión se persiste en `localStorage` (`frontend/src/stores/auth.store.ts`, clave `patitas-auth`) y se envía como `Bearer` desde el interceptor de Axios (`frontend/src/services/api.ts`). No fue una decisión explícita: quedó así por defecto. Cualquier script inyectado (XSS) puede leerlo. Mitigaciones actuales: sesiones validadas contra la base con `token_version` (#204), limpieza de caché en logout (#175), escape por defecto de React.
- **Propuesta:** evaluar con el criterio de evolución tecnológica (CX01) el paso a cookie `httpOnly` + `Secure` + `SameSite`, lo que implica protección CSRF, CORS con credenciales y adaptar el handshake JWT de Socket.IO.
- **Criterio de aceptación:** el token no es accesible desde JavaScript del navegador y los flujos de login, chat en tiempo real y logout siguen funcionando (tests e2e).

---

## [CHORE] Geocodificación inversa: cumplir la política de uso de Nominatim y preparar el escalado

- **Origen:** entrevista C09 (2026-10-22).
- **Labels sugeridos:** `type: chore`, `epic: geolocalización`, `priority: low`, `area: frontend`, `area: backend`
- **Descripción:** `frontend/src/components/reports/LocationPicker.tsx` consulta `https://nominatim.openstreetmap.org/reverse` directamente desde el navegador de cada usuario. La política oficial (https://operations.osmfoundation.org/policies/nominatim/) fija un máximo absoluto de 1 request por segundo **por aplicación** (sumando todos sus usuarios) y exige identificar la aplicación con Referer o User-Agent válido. Para el piloto es suficiente; con usuarios concurrentes el sistema podría superar el límite y ser bloqueado.
- **Propuesta:** evaluar con el criterio CX01: (a) proxy en el backend con caché por coordenadas redondeadas y rate limit global, identificando la aplicación; (b) instancia propia de Nominatim; (c) proveedor pago.
- **Criterio de aceptación:** las consultas de geocodificación inversa respetan el límite de 1 req/s por aplicación y se identifican conforme a la política.

---

## [FEATURE] Ajustar los parámetros del matching con evidencia (ventana 90 días, umbral calibrado)

- **Origen:** entrevista C14 (2026-10-22).
- **Labels sugeridos:** `type: story`, `epic: matching`, `priority: medium`, `area: backend`
- **Descripción:** Los parámetros del matching (`backend-ia/app/services/matching_service.py`: umbral 0,75, radio 5 km, ventana 30 días, top 5) son provisionales. Lord et al. (2007, JAVMA) reporta recuperaciones de hasta 81 días; con 30 días se pierden coincidencias tardías. El umbral 0,75 nunca se calibró con datos.
- **Propuesta:** (1) ampliar la ventana a 90 días; (2) fijar el umbral según el benchmark (`backend-ia/benchmarks/`, umbral óptimo y TAR@FAR=1 %); (3) llevar los parámetros a configuración para ajustarlos con datos del piloto sin tocar código. Evaluar según CX01.
- **Criterio de aceptación:** los parámetros se leen de configuración, la ventana es de 90 días y el umbral coincide con el valor justificado por el benchmark.

---

## [FEATURE] Ocultamiento automático de reportes por acumulación de denuncias

- **Origen:** entrevista C16 (2026-10-22), propuesta del PM.
- **Labels sugeridos:** `type: story`, `epic: moderación`, `priority: medium`, `area: backend`, `area: frontend`
- **Descripción:** Hoy cada denuncia (`ReportFlag`, una por usuario y reporte) la resuelve un moderador a mano. Se busca que la moderación sea mayormente automática sin permitir que un grupo de usuarios baje reportes legítimos.
- **Propuesta:**
  1. Tipificar los motivos de denuncia (hoy `reason` es texto libre): p. ej. "no es un animal", "contenido ofensivo", "spam", "duplicado".
  2. Al alcanzar N denuncias de usuarios distintos con email verificado por el mismo motivo, el reporte pasa a un estado oculto (no se elimina).
  3. El reporte oculto entra a la cola del moderador y se notifica al dueño.
  4. Reversible: si el moderador lo considera válido, vuelve a publicarse. N configurable.
- **Criterio de aceptación:** con N denuncias verificadas del mismo motivo el reporte deja de verse en el feed, aparece en la cola de moderación con su motivo, el dueño recibe una notificación y el moderador puede restaurarlo.

---

## Creados en GitHub (2026-10-22, aprobados por el usuario)

| Issue | Borrador | Prioridad propuesta (campo Priority del Project) |
|---|---|---|
| #213 | [CHORE] Test de contrato de esquema entre Prisma y backend-ia | Low |
| #214 | [BUG] La inferencia de embeddings bloquea el event loop de FastAPI | Medium |
| #215 | [REFACTOR] Mover el JWT de localStorage a una cookie httpOnly | Low |
| #216 | [CHORE] Geocodificación inversa: política de uso de Nominatim | Low |
| #217 | [FEATURE] Ajustar los parámetros del matching (ventana 90 días, umbral calibrado) | Medium |
| #218 | [FEATURE] Ocultamiento automático de reportes por acumulación de denuncias | Medium |

Todos agregados a "Patitas-Project-G1" en Status = Backlog. El campo Priority del Project no tiene opciones configuradas (pendiente).

---

# Brechas funcionales (relevamiento de flujos para 1.2.2, 2026-10-24)

Detectadas al recorrer los flujos punta a punta contra el código. Se cruzaron con los issues abiertos: la navegación sin login ya está en #187, el selector de ubicación en mapa en #208, los pines por color en #209, el cierre de casos inactivos en #210 y la restauración de reportes ocultados automáticamente en #218.

---

## [BUG] La foto del reporte figura como obligatoria pero es opcional

- **Origen:** relevamiento del flujo de alta de reporte (2026-10-24).
- **Labels sugeridos:** `type: bug`, `epic: mascotas`, `priority: medium`, `area: frontend`, `area: backend`
- **Descripción:** El formulario muestra "Foto *" (`frontend/src/components/reports/ReportForm.tsx:164`), pero la foto es opcional en el validador del frontend (`frontend/src/types/validators/report.validator.ts:26`) y en el del backend (`backend/src/validators/reports.validator.ts:15`). Un reporte sin foto se publica directo, sin moderación de IA y sin embedding, así que nunca participa del matching.
- **Propuesta:** el equipo define si la foto es obligatoria y después alinea la etiqueta y los dos validadores con esa decisión.
- **Criterio de aceptación:** la etiqueta, el validador del frontend y el del backend coinciden. Si la foto queda opcional, la interfaz avisa que el reporte no entra al matching automático.

---

## [CHORE] Sin `AI_SERVICE_URL`, los reportes con foto quedan en `pending` indefinidamente

- **Origen:** relevamiento del flujo de moderación por IA (2026-10-24).
- **Labels sugeridos:** `type: chore`, `epic: infra`, `priority: low`, `area: backend`
- **Descripción:** La variable es opcional por diseño (`backend/README.md:18`). Si no está, `triggerEmbeddingGeneration` no hace nada (`backend/src/services/matching.service.ts:94-95`) y la reconciliación tampoco (`:210`). Un reporte con foto se crea en `pending` y no sale nunca de ese estado, sin ningún aviso al usuario ni al operador.
- **Propuesta:** registrar una advertencia al arrancar cuando falte la variable y exponer en `/health` si el backend de IA está configurado y responde.
- **Criterio de aceptación:** con la variable ausente, el arranque registra una advertencia y `/health` informa el servicio de IA como no configurado.

---

## [FEATURE] Confirmar una coincidencia debería avisar a la otra parte y ofrecer el cierre del reporte

- **Origen:** relevamiento del flujo de matching (2026-10-24).
- **Labels sugeridos:** `type: story`, `epic: matching`, `priority: medium`, `area: backend`, `area: frontend`
- **Descripción:** `decideMatch` (`backend/src/services/matching.service.ts:302`) solo cambia el estado del match a `confirmed` o `rejected`. No notifica al autor del otro reporte ni cambia el estado de ninguno de los dos reportes. Además, `listMatches` (`:274`) no filtra por el estado del otro reporte, de modo que sigue mostrando coincidencias con reportes que después se rechazaron.
- **Propuesta:** al confirmar, crear una notificación para el autor del otro reporte, ofrecer al dueño cerrar su reporte y excluir de `listMatches` los reportes que no estén `published` ni `resolved`.
- **Criterio de aceptación:** confirmar una coincidencia genera la notificación a la otra parte, y el listado no muestra coincidencias con reportes rechazados.
- **Relación:** #210 (cierre de reportes).

---

## [FEATURE] Las notificaciones deberían enlazar al reporte que mencionan

- **Origen:** relevamiento del flujo de notificaciones (2026-10-24).
- **Labels sugeridos:** `type: story`, `epic: notificaciones`, `priority: low`, `area: frontend`
- **Descripción:** La notificación ya guarda `reportId` (`backend/prisma/schema.prisma:284`), pero `frontend/src/components/notifications/NotificationList.tsx` no lo usa. El usuario recibe "posible coincidencia" y tiene que buscar el reporte a mano.
- **Propuesta:** que cada notificación con `reportId` navegue a `/reports/:id` y quede marcada como leída.
- **Criterio de aceptación:** un clic en una notificación de coincidencia abre el reporte correspondiente.

---

## [FEATURE] Moderación manual: descartar una denuncia sin ocultar el reporte

- **Origen:** relevamiento del flujo de moderación comunitaria (2026-10-24).
- **Labels sugeridos:** `type: story`, `epic: moderación`, `priority: medium`, `area: backend`, `area: frontend`
- **Descripción:** Resolver una denuncia (`backend/src/services/report-flags.service.ts:62-87`) siempre la marca `reviewed` y pasa el reporte a `rejected`. El moderador no puede descartar una denuncia infundada, y el autor no recibe aviso cuando su reporte se oculta. #218 cubre la restauración y el aviso solo para el ocultamiento automático.
- **Propuesta:** dos acciones en el panel (aceptar, que oculta, y descartar, que mantiene el reporte publicado) y una notificación `report_status_change` al autor cuando la denuncia se acepta. La restauración manual se alinea con la de #218.
- **Criterio de aceptación:** el moderador puede descartar sin ocultar, y el autor recibe una notificación cuando su reporte se oculta por una denuncia.
- **Relación:** #218 (ocultamiento automático), #38 (suspensión de cuentas).

---

## [FEATURE] Gestión de roles: asignar moderadores y definir los permisos de `admin`

- **Origen:** relevamiento de roles y permisos (2026-10-24).
- **Labels sugeridos:** `type: story`, `epic: auth`, `priority: low`, `area: backend`
- **Descripción:** No existe ningún endpoint ni procedimiento documentado para asignar el rol `moderador`. El único `admin` se crea en `backend/prisma/seed.ts`. En el código, `admin` solo aparece en `requireRole("moderador", "admin")` (`backend/src/routes/report-flags.routes.ts:10-11`), así que tiene exactamente los mismos permisos que `moderador`.
- **Propuesta:** un endpoint exclusivo de `admin` para asignar y quitar el rol `moderador`, o documentar el procedimiento manual si el equipo decide postergarlo.
- **Criterio de aceptación:** un `admin` puede asignar el rol `moderador` sin editar la base a mano, y un `moderador` no puede hacerlo.
- **Relación:** #31 (roles y autorización).

---

## [FEATURE] Interfaz para mascotas y para editar o eliminar un reporte

- **Origen:** relevamiento de flujos (2026-10-24).
- **Labels sugeridos:** `type: story`, `epic: mascotas`, `priority: low`, `area: frontend`
- **Descripción:** El backend implementa el CRUD de mascotas (`backend/src/routes/pets.routes.ts`) y la edición y eliminación de reportes (`backend/src/services/reports.service.ts:210`, `:290`), pero el frontend no tiene páginas ni servicios que los usen. `ReportForm` nunca envía `petId`, así que el filtro por raza del backend no tiene uso real. Además, `GET /api/pets` devuelve todas las mascotas sin autenticación (`backend/src/services/pets.service.ts:10`).
- **Propuesta:** páginas "Mis mascotas" y "Editar reporte", y restringir el listado de mascotas al dueño.
- **Criterio de aceptación:** el dueño puede crear, editar y eliminar sus mascotas y sus reportes desde la interfaz, y el listado de mascotas solo muestra las propias.
- **Relación:** #13 (CRUD, cerrado), #12.

---

## [CHORE] Historias cerradas sin implementación verificable

- **Origen:** relevamiento de flujos (2026-10-24).
- **Labels sugeridos:** `type: chore`, `epic: qa`, `priority: medium`
- **Descripción:** Dos historias están cerradas aunque sus criterios de aceptación no se cumplen en el código:
  - #33 (preferencias de notificación): no hay modelo, endpoint ni pantalla de preferencias (una búsqueda de "preferen" en `backend/` y `frontend/src` no devuelve resultados).
  - #13 (CRUD de mascotas): no tiene frontend.
- **Propuesta:** reabrirlas o dividirlas en una parte hecha y otra pendiente, para que el estado del tablero coincida con el código. El informe (1.2.2.2) toma el estado del código, no el del issue.
- **Criterio de aceptación:** cada historia cerrada tiene sus criterios de aceptación cumplidos o una nota que explica el alcance parcial.

---

## Comentario sugerido en #208 (no es un issue nuevo)

> El backend ya expone `GET /api/geo/nearby` (radio en km) y `GET /api/geo/map` (bounding box), en `backend/src/services/geo.service.ts`, pero el frontend no los usa: el mapa del feed dibuja la misma lista del feed. Además, `MapView` arranca centrado en Buenos Aires (`frontend/src/components/reports/MapView.tsx:18`, `[-34.6037, -58.3816]`), no en la zona del piloto. Conviene incluir ambos puntos en el alcance de este issue.

---

## Creados en GitHub (2026-10-24, aprobados por el usuario)

| Issue | Borrador | Prioridad propuesta (campo Priority del Project) |
|---|---|---|
| #219 | [BUG] La foto del reporte figura como obligatoria pero es opcional | Medium |
| #220 | [CHORE] Sin `AI_SERVICE_URL`, los reportes con foto quedan en `pending` | Low |
| #221 | [FEATURE] Confirmar una coincidencia: avisar a la otra parte y ofrecer el cierre | Medium |
| #222 | [FEATURE] Las notificaciones deberían enlazar al reporte | Low |
| #223 | [FEATURE] Moderación manual: descartar una denuncia sin ocultar el reporte | Medium |
| #224 | [FEATURE] Gestión de roles: asignar moderadores y permisos de `admin` | Low |
| #225 | [FEATURE] Interfaz para mascotas y para editar o eliminar un reporte | Low |
| #226 | [CHORE] Historias cerradas sin implementación verificable | Medium |

Todos agregados a "Patitas-Project-G1" en Status = Backlog, sin label de prioridad (el usuario la asigna en el Project). Comentario publicado en #208.
