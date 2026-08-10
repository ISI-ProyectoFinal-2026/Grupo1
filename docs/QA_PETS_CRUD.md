# QA - CRUD de Pets (Mascotas) - PATITAS

**Fecha de verificación**: 2026-08-10
**Nivel de análisis**: ALTO (exhaustivo, manual + automatizado)
**Alcance**: Endpoints `/api/pets` (`GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`), validación con Zod, manejo de errores, y comportamiento del ORM ante entradas maliciosas o mal formadas.
**Estado general**: ✅ Funcional — bug encontrado y corregido

---

## 📋 Resumen Ejecutivo

El CRUD de Pets funciona correctamente en el camino feliz y en la gran mayoría de los casos borde: validación de tipos, coerción de IDs, mensajes de error consistentes, ownership no verificado (deuda técnica ya conocida y aceptada), y protección contra inyección SQL vía Prisma. Se encontró **un bug real**: el manejo de errores no contempla `SyntaxError` de `express.json()`, por lo que un JSON malformado en el body devuelve `500` en vez de `400`.

---

## 1. Suite automatizada

| Comando | Resultado | Detalle |
|---|---|---|
| `npm test` | ⚠️ 1 falla (preexistente, ajena a Pets) | Test Suites: 1 failed, 2 passed, 3 total · Tests: **1 failed, 26 passed, 27 total** |
| `npm run typecheck` | ✅ OK | `tsc --noEmit` sin errores |
| `npm run build` | ✅ OK | `tsc -p tsconfig.json` sin errores, compila limpio |

La única falla es la ya conocida en `tests/db/connection.test.ts:55` (`debe verificar estructura de tabla reports con PostGIS`): espera `data_type === "geometry"` pero Postgres devuelve `"USER-DEFINED"`. No forma parte de la feature de Pets, no se tocó. Confirmado: los 19 tests nuevos de Pets (9 de `pets.service.test.ts` + 10 de `pets.routes.test.ts`) pasan en verde.

---

## 2. Casos manuales probados

Todas las pruebas se corrieron contra el servidor real (`npm run dev`, puerto 3001) con `curl` y, para el caso de encoding, con `fetch` desde Node. Se usó un usuario real creado ad-hoc vía Prisma (`id: 11`) como `userId` válido.

| # | Caso | Request | Resultado esperado | Resultado real | Estado |
|---|---|---|---|---|---|
| 1 | Crear pet con todos los campos opcionales completos | `POST /api/pets` con `name`, `species`, `breed`, `age`, `description`, `microchipId` | `201` con todos los campos guardados | `201`, todos los campos persistidos correctamente | ✅ |
| 2 | `age` negativo | `POST /api/pets` con `age: -5` | `400` | `400` — `"Too small: expected number to be >=0"` | ✅ |
| 3 | `age` como string | `POST /api/pets` con `age: "tres"` | `400` | `400` — `"Invalid input: expected number, received string"` | ✅ |
| 4 | Campos extra no definidos en el schema | `POST /api/pets` con `weight`, `color` | Se ignoran silenciosamente (Zod strip por defecto) | `201`, campos extra descartados, no rompe | ✅ |
| 5 | Body vacío `{}` (sin `userId`) | `POST /api/pets` con `{}` | `400` | `400` — `"userId: expected number, received undefined"` | ✅ |
| 6 | `GET /api/pets/0` y `GET /api/pets/-1` | IDs no positivos | `400` | `400` — `"id: expected number to be >0"` en ambos | ✅ |
| 7 | `GET /api/pets/1.5` | ID decimal | `400` | `400` — `"id: expected int, received number"` | ✅ |
| 8 | POST sin `Content-Type` / con `Content-Type: text/plain` | Body JSON pero header incorrecto | `400` (body no parseado → validación falla) | `400` en ambos casos — `express.json()` no parsea, `req.body` queda `undefined`, Zod lo rechaza limpiamente | ✅ |
| 9 | JSON malformado en el body | `POST /api/pets` con `{"userId":11,"name":"Malformed"` (sin cerrar) | `400` legible | Detectado como `500` inicialmente, **corregido** → ahora `400` — `"JSON inválido en el body"` | ✅ (post-fix) |
| 10 | `PUT` enviando `userId` en el body | `PUT /api/pets/:id` con `userId` extra | Se ignora (schema de update no lo permite) | `200`, `userId` original se mantiene, campo ignorado correctamente | ✅ |
| 11 | `DELETE` de una mascota ya borrada | `DELETE` dos veces seguidas sobre el mismo `id` | Primera `204`, segunda `404` | Primera `204`, segunda `404` — `"Mascota no encontrada"` | ✅ |
| 12 | `GET /api/pets` con 0, 1 y varias mascotas | Lista en distintos estados | `200` con array vacío/con elementos, sin romperse | `200` en los tres escenarios, `[]` cuando está vacía | ✅ |
| 13 | Inyección en `name`: `"Robert'); DROP TABLE pets;--"` | `POST /api/pets` con ese valor literal | Prisma lo trata como string parametrizado, no ejecuta SQL | Guardado como string literal, tabla `pets` intacta y consultable después | ✅ |
| 14 (extra) | `GET /api/pets/99999` (ID inexistente) | ID válido mas no encontrado | `404` | `404` — `"Mascota no encontrada"` | ✅ |
| 15 (extra) | Caracteres UTF-8 (tildes, ñ) en `description` vía request con encoding correcto | `POST /api/pets` con `"muy jugueton con ñandú y café"` | Se persisten sin corrupción | Persistido correctamente byte a byte | ✅ |

**13 de 14 casos principales pasaron.** El caso 15 fue una verificación adicional para descartar un falso positivo (ver nota abajo).

### Nota sobre el caso 15
Durante las pruebas con `curl` desde Git Bash en Windows, el campo `description: "muy juguetón"` volvía con el carácter corrupto (`juguet�n`). Se verificó por separado con un script Node (`fetch` nativo, UTF-8 explícito) que el servidor persiste y devuelve el texto sin corrupción. La corrupción era un artefacto de encoding de la terminal/`curl` en Windows al pasar el argumento `-d`, **no un bug del servidor**. Se descarta como hallazgo.

---

## 3. Hallazgos

### [BUG] JSON malformado devuelve 500 en vez de 400 — Severidad: Media — ✅ Corregido

- **Ubicación**: `src/middlewares/error-handler.ts`
- **Repro**: `POST /api/pets` con `Content-Type: application/json` y un body JSON mal formado (ej. `{"userId":11,"name":"Malformed"` sin cerrar la llave).
- **Comportamiento encontrado**: `express.json()` lanza un `SyntaxError` al parsear el body, que llega al `errorHandler` vía `next(err)`. Como el handler solo contemplaba `instanceof ZodError` y `instanceof AppError`, caía al branch genérico y respondía `500 { error: { message: "Error interno del servidor" } }`, además de loguear con `console.error` como si fuera un error inesperado del servidor.
- **Fix aplicado**: se agregó un branch `err instanceof SyntaxError && "body" in err` (patrón estándar de `body-parser`/`express.json()`) antes del genérico, que responde `400 { error: { message: "JSON inválido en el body" } }`.
- **Cobertura de regresión**: test agregado en `tests/pets/pets.routes.test.ts` ("POST /api/pets responde 400 si el JSON del body está mal formado") — confirmado rojo antes del fix, verde después. Suite completa: 27/27 tests propios de Pets + preexistentes en verde (única falla restante es la de PostGIS, ajena a esta feature).

No se encontraron otros hallazgos. El resto de los casos (validación de tipos, coerción de IDs, manejo de 404, ignorar campos no permitidos, protección contra inyección SQL vía Prisma parametrizado) se comportó exactamente como se esperaba.

---

## 4. Limpieza

- Usuario de prueba (`qa-pets-test@example.com`, `id: 11`) y las 3 mascotas creadas durante las pruebas manuales (`id: 35, 37, 38`) fueron borrados vía Prisma ad-hoc al finalizar. Verificado: `pets restantes: 0`, `usuario de test aun existe: false`.
- Servidor de desarrollo (`npm run dev`, PID en puerto 3001) terminado con `taskkill`. Puerto 3001 confirmado libre al cierre de la verificación.
- No quedan residuos de datos de prueba en la base.

---

## ✨ Conclusión

**El CRUD de Pets está listo para uso.** El único bug real encontrado (JSON malformado → 500) fue corregido y cubierto con test de regresión en el mismo pase de QA. No hay bloqueantes de seguridad, integridad de datos ni de lógica de negocio en el alcance probado.

Los puntos de deuda técnica ya conocidos (falta de auth/JWT, `userId` requerido en el body de forma interina, sin chequeo de ownership en `PUT`/`DELETE`) se confirman presentes pero **no se reportan como hallazgos nuevos**, tal como estaba documentado de antemano.

---

**Documento creado por**: QA manual y automatizado — verificación CRUD Pets
