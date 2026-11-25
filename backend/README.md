# Backend Principal — Base de datos

Setup de base de datos para la issue "Configurar la base de datos con sus respectivos modelos y esquemas". Cubre modelos, esquema y migraciones para el **Backend Principal** (Node/Express/Prisma). El resto del backend (auth, rutas, WebSocket, etc.) queda fuera de esta issue.

## Variables de entorno

Copiar `.env.example` a `.env` (no versionado) y ajustar:

```bash
cp .env.example .env
```

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | sí | Puerto `5433` en el host, ver `../docker/ENV_VARS.md` |
| `JWT_SECRET` / `JWT_EXPIRY` | sí | Firma de los tokens de sesión |
| `INTERNAL_API_KEY` | **sí** | Clave compartida con el Backend IA. **Mismo valor que en `../backend-ia/.env`** (ver abajo) |
| `REDIS_URL` | no | Cola del pipeline IA (BullMQ, #177), ej. `redis://localhost:6379`. Sin ella el pipeline corre en proceso con reintentos en memoria (el arranque lo advierte en el log). Ver "Cola del pipeline IA" |
| `AI_SERVICE_URL` | no | Backend IA. Si no está seteada, el trigger de generación de embedding no hace nada (no rompe la creación del reporte, ver `src/services/matching.service.ts`), pero los reportes con foto quedan en `pending`: el arranque lo advierte en el log, `GET /health` informa `ai: "not_configured"` y `GET /health/ai` responde 503 (200 si el Backend IA contesta) |
| `FRONTEND_URL` | no | Origen permitido por CORS y base de los enlaces `/verify-email` y `/reset-password` de los emails (default `http://localhost:5173`) |
| `TRUST_PROXY` | no | Cantidad de proxies delante del backend (ej. `1` detrás del proxy de Vite, un túnel o el load balancer). Sin esto, los rate limiters ven la IP del proxy y el límite pasa a ser global. Vacío/`false` = no confiar en ningún proxy. `true` se rechaza a propósito: confiaría en un `X-Forwarded-For` que el cliente puede falsificar |
| `PORT` | no | Default `3001` |
| `SMTP_HOST` | en producción | Servidor SMTP. Vacío en desarrollo/test = los emails se imprimen en consola. Vacío en producción = reenviar verificación y recuperar contraseña responden `503` `MAIL_NOT_CONFIGURED` |
| `SMTP_PORT` / `SMTP_SECURE` | no | Puerto (default `587`, STARTTLS) y `true` solo para TLS directo (puerto `465`) |
| `SMTP_USER` / `SMTP_PASS` | no | Credenciales del servidor SMTP, si las exige |
| `MAIL_FROM` | no | Remitente que ven los usuarios (default `PATITAS <no-reply@patitas.local>`) |
| `TWO_FACTOR_ENCRYPTION_KEY` | en producción | Clave de 32 bytes que cifra los secretos del segundo factor (2FA). Obligatoria en producción. Generarla con `openssl rand -base64 32`. Fuera de producción, si falta, se deriva de `JWT_SECRET` |
| `R2_*` | no | Upload de imágenes. Si faltan, `POST /api/uploads/presign` responde `503` diciendo cuál falta |

### Emails (verificación de cuenta y recuperación de contraseña)

El backend manda dos tipos de email con un enlace de un solo uso: verificar el email (24 h) y restablecer la contraseña (30 min). Los enlaces apuntan a `FRONTEND_URL`.

- **Desarrollo** (`NODE_ENV` distinto de `production`) sin `SMTP_HOST`: el email se imprime en la consola del backend, con el enlace incluido. No hace falta ningún servidor de correo. Con `NODE_ENV=test` no se imprime nada.
- **Con `SMTP_HOST`**: se envía por SMTP en cualquier entorno.
- **Producción sin `SMTP_HOST`**: `POST /api/auth/verify-email/resend` y `POST /api/auth/forgot-password` responden `503` con código `MAIL_NOT_CONFIGURED` y `details.missingEnvVars: ["SMTP_HOST"]`; el reenvío no gasta token ni cooldown. El registro igual responde `201` (el error se loguea) para no bloquear el alta.

El reenvío de verificación tiene un cooldown de 60 s por usuario (`429` `RESEND_COOLDOWN`, con `details.retryAfterSeconds`).

### Segundo factor (2FA) — `TWO_FACTOR_ENCRYPTION_KEY`

Los secretos TOTP se guardan cifrados (AES-256-GCM) con esta clave; en la base nunca queda el secreto en claro.

- **Formato**: 32 bytes en base64 o 64 caracteres hexadecimales. Generarla con `openssl rand -base64 32`.
- **Producción**: es obligatoria. Sin ella (o con un valor inválido) activar el 2FA, usar el segundo paso del login, desactivarlo o regenerar los códigos responden `503` `TWO_FACTOR_NOT_CONFIGURED` con `details.missingEnvVars: ["TWO_FACTOR_ENCRYPTION_KEY"]`. El backend arranca igual y el login, el registro y las cuentas sin 2FA no se ven afectados: la clave se exige recién cuando hace falta un secreto.
- **Desarrollo y test**: si no está seteada, la clave se deriva de `JWT_SECRET`, así que no hace falta configurar nada. Un valor presente pero inválido falla siempre, en cualquier entorno.
- **Perder o cambiar la clave**: los secretos ya guardados dejan de poder descifrarse y esos usuarios no pueden completar el segundo paso (`503`). Pueden recuperar la cuenta con el reinicio por autoservicio de 72 h (más abajo), que no necesita la clave; la otra salida es desactivarles el 2FA directo en la base. No hay rotación automática: guardar la clave en el mismo lugar que el resto de los secretos y no cambiarla con usuarios que ya activaron el 2FA.

#### Reinicio del 2FA por autoservicio (72 h)

Quien perdió el dispositivo y también los códigos de recuperación lo pide desde el segundo paso del login, sin intervención de un admin:

1. `POST /api/auth/2fa/reset/request` con el desafío del login y la contraseña. Manda un mail con un link de confirmación (vence a los 30 min; `429` `TWO_FACTOR_RESET_COOLDOWN` si se pide otro antes de 60 s, `503` `MAIL_NOT_CONFIGURED` en producción sin SMTP).
2. `POST /api/auth/2fa/reset/confirm` con el token del link (el frontend lo manda solo tras un click explícito). Arranca la espera de 72 h, medida con la hora de la base, y manda un aviso con el link para cancelar.
3. Durante la espera el reinicio se cancela con `POST /api/auth/2fa/reset/cancel` (link del aviso, sin sesión) o con cualquier login real de segundo factor (código de la app o de recuperación). Ambos caminos mandan el aviso "reinicio cancelado".
4. Pasadas las 72 h, el próximo login con contraseña correcta apaga el 2FA, borra los códigos de recuperación, cierra las demás sesiones y devuelve la sesión en la misma respuesta (más un aviso por mail). No hay cron: se completa de forma perezosa en el login. No necesita la clave de cifrado y no lo frena el bloqueo por intentos.

Restablecer la contraseña por email no toca el 2FA ni un reinicio pendiente.

### `INTERNAL_API_KEY`

Es la clave que usan el Backend Principal y el Backend IA para reconocerse entre sí en las llamadas server-to-server, donde no hay usuario logueado ni JWT. **Tiene que tener el mismo valor en los dos servicios.**

Se usa en una sola dirección, **Node → Backend IA** (`POST /images/analyze` y `POST /images/embedding`): se manda en el header `X-Internal-Key` y el Backend IA falla cerrado si falta. Si no coincide, el Backend IA responde `401` y el reporte con imagen **se queda en `pending`** — el log lo dice explícitamente para que no se confunda con una caída del servicio. El Backend IA no llama de vuelta a este backend (ADR-0029).

Detalle completo en `../docker/ENV_VARS.md` y en `../backend-ia/README.md`.

(usar las mismas credenciales/puerto que `docker/ENV_VARS.md` si se cambiaron los defaults; el contenedor publica en `5433` del host para no chocar con un Postgres nativo local en `5432`).

## Levantar la base de datos

Desde la raíz del repo (`Grupo1/`):

```bash
docker compose up -d postgres
```

## Instalar dependencias y aplicar el esquema

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy   # aplica backend/prisma/migrations/20260809000000_init
```

## Verificar la conexión

```bash
npm run db:check
```

Imprime éxito si la conexión funciona y si las extensiones `postgis` y `vector` están activas (criterio de aceptación de la issue).

## Crear una migración nueva

```bash
npm run prisma:migrate   # prisma migrate dev
```

Este comando necesita una terminal interactiva real. Si se corre desde un entorno sin TTY (CI, scripts, agentes), Prisma puede llegar a aplicar el cambio en la base de desarrollo y fallar recién al escribir el archivo de la migración, dejando el historial (`_prisma_migrations`) desincronizado del contenido de `prisma/migrations/`. Si eso pasa:

1. Revisar con `docker exec patitas-postgres psql -U patitas -d patitas -c "\d <tabla>"` qué se aplicó realmente.
2. Revertir esos cambios a mano si no quedó un `.sql` correspondiente en `prisma/migrations/`.
3. Borrar la fila fantasma de `_prisma_migrations` (o `npx prisma migrate resolve --rolled-back <nombre>` si quedó marcada como fallida).
4. Escribir el `migration.sql` a mano en `prisma/migrations/<timestamp>_<nombre>/` y aplicar con `npm run prisma:deploy`.

`npm run prisma:deploy` (usado para levantar el proyecto) sí es seguro en cualquier entorno no interactivo.

## Modelos

Ver `prisma/schema.prisma`. Mapea 1:1 el esquema documentado en `../docs/ARQUITECTURA.md` (sección 5): `users`, `pets`, `reports`, `report_embeddings`, `report_matches`, `chats`, `messages`, `notifications`.

**Prisma es la única fuente de migraciones** y este backend es el único servicio que accede a la base (ADR-0029): el Backend IA no tiene conexión ni credenciales. `report_embeddings` usa `vector(768)`, que Prisma no modela, así que se lee y escribe con SQL crudo (`src/services/report-matching.service.ts`).

## Matching por similitud (issue #18)

Al crear un reporte (la foto es obligatoria) o cambiarle las fotos, el backend encola un job en Redis (ver "Cola del pipeline IA"); el worker pide el embedding de la foto al Backend IA (`POST /images/embedding`) y `src/services/matching.service.ts` resuelve la moderación:

- con mascota: guarda el embedding en `report_embeddings` (solo si el reporte sigue mostrando esa foto), busca matches (best-effort: si falla se loguea y no frena la publicación) y publica el reporte;
- sin mascota (`has_animal: false`): rechaza el reporte;
- `422` (imagen no disponible), `401`, otro status, cuerpo inválido o falla de red: inconcluso, el reporte queda `pending`. Ante falla de red o `5xx` el job se reintenta (ver abajo).

### Cola del pipeline IA (issue #177)

`src/services/report-pipeline.service.ts` usa BullMQ sobre Redis (`REDIS_URL`):

- **Productor**: `reports.service` encola `{ reportId, imageUrl }` con `jobId = report-<id>`. Encolar dos veces el mismo reporte no duplica el job; si el job en espera tiene otra foto (el dueño la cambió) se reemplaza, y uno ya en ejecución se deja terminar (su veredicto se descarta porque la foto no coincide y la reconciliación lo reencola).
- **Worker**: arranca con el server (`src/index.ts`), procesa de a un job (el Backend IA infiere de forma síncrona) y hace un solo request por intento. Ante falla de red o `5xx`, BullMQ reintenta con backoff exponencial: 5 intentos, esperas de 5 s, 10 s, 20 s y 40 s. Cada fallo se loguea con el prefijo `[cola-ia]`; agotados los intentos, el reporte queda `pending` hasta la próxima reconciliación.
- **Estado**: el reporte queda `pending` mientras el pipeline no termina (no hay un estado `processing` aparte).
- **Sin Redis**: sin `REDIS_URL`, o si Redis no acepta el job en 5 s, el pipeline corre en proceso como antes (reintentos en memoria tras 1 s, 5 s y 30 s). Los tests corren así (`tests/setup-env.ts` vacía `REDIS_URL`); los de la cola mockean BullMQ.

La búsqueda (`src/services/report-matching.service.ts`) toma candidatos publicados de tipo opuesto (lost↔found), dentro de un radio y una ventana de tiempo, de autores sin suspensión vigente, ordenados por similitud coseno (top K); guarda en `report_matches` los que superan `MATCH_THRESHOLD` (sin pisar un match ya confirmado o rechazado) y notifica a los dueños de los que además superan `NOTIFY_THRESHOLD` (un fallo al notificar se loguea y no corta el matching). `GET /api/reports/:id/matches` lista esos candidatos.

Los parámetros se leen de variables de entorno en cada búsqueda (`src/config/matching.ts`, ADR-0014); un valor ausente o inválido usa el default:

| Variable | Valor por defecto | Significado |
| --- | --- | --- |
| `MATCH_THRESHOLD` | `0.45` | similitud mínima para guardar un match (entre 0 y 1) |
| `NOTIFY_THRESHOLD` | `0.63` | similitud mínima para notificar (entre 0 y 1) |
| `MATCH_RADIUS_METERS` | `5000` | radio de búsqueda |
| `MATCH_WINDOW_DAYS` | `90` | antigüedad máxima de los candidatos |
| `MATCH_TOP_K` | `5` | cantidad de candidatos evaluados |

La similitud se calcula con `1 - (a <=> b)`: **`<=>` es distancia coseno**, y es el único operador que puede usar el índice HNSW (creado con `vector_cosine_ops`). No cambiarlo por `<->` (distancia L2): aun con embeddings normalizados `1 - L2` no es la similitud coseno y el umbral deja de tener sentido. `ST_DWithin` mide en metros porque ambos operandos se castean a `geography`.

Con `LIMIT 5` los matches visibles dependen del orden de carga: un reporte con más de 5 candidatos sobre el umbral solo guarda los 5 mejores; el resto aparece cuando se recalcula desde el otro lado (por ejemplo con `npm run reembed:reports`, que regenera todos los embeddings y después recalcula los matches; ver `../backend-ia/README.md`, "Cambiar de modelo de embeddings").

### Reportes atascados en `pending`

Todo reporte nace `pending` (la foto es obligatoria) y solo pasa a `published` (o `rejected`) cuando llega el veredicto del Backend IA. Los reintentos se agotan (en la cola, o en memoria a los ~36 s sin Redis), así que si el Backend IA estuvo caído más que eso —o, sin Redis, si el proceso de Node se reinició con la llamada en vuelo— el reporte se quedaba en `pending` para siempre: invisible en el feed, sin embedding y sin poder matchear.

`reconcilePendingReports()` es la red de contención: al levantar el server y cada 5 minutos vuelve a encolar la generación de embedding para los reportes `pending` con imagen que ya pasaron el grace period de 2 minutos y siguen dentro de una ventana de 24 horas. Pasadas esas 24 horas se deja de insistir (una imagen borrada del storage no se arregla reintentando) y el reporte queda para revisión manual:

```sql
SELECT id, title, created_at FROM reports
WHERE status = 'pending' AND image_url IS NOT NULL
  AND created_at < now() - interval '24 hours';
```

Como todo el flujo depende de `AI_SERVICE_URL`, si esa variable no está seteada la reconciliación no hace nada (mismo criterio que el disparo original).
