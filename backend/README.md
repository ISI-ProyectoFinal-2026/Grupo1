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
| `AI_SERVICE_URL` | no | Backend IA. Si no está seteada, el trigger de generación de embedding no hace nada (no rompe la creación del reporte, ver `src/services/matching.service.ts`) |
| `FRONTEND_URL` | no | Origen permitido por CORS y base de los enlaces `/verify-email` y `/reset-password` de los emails (default `http://localhost:5173`) |
| `TRUST_PROXY` | no | Cantidad de proxies delante del backend (ej. `1` detrás del proxy de Vite, un túnel o el load balancer). Sin esto, los rate limiters ven la IP del proxy y el límite pasa a ser global. Vacío/`false` = no confiar en ningún proxy. `true` se rechaza a propósito: confiaría en un `X-Forwarded-For` que el cliente puede falsificar |
| `PORT` | no | Default `3001` |
| `SMTP_HOST` | en producción | Servidor SMTP. Vacío en desarrollo/test = los emails se imprimen en consola. Vacío en producción = reenviar verificación y recuperar contraseña responden `503` `MAIL_NOT_CONFIGURED` |
| `SMTP_PORT` / `SMTP_SECURE` | no | Puerto (default `587`, STARTTLS) y `true` solo para TLS directo (puerto `465`) |
| `SMTP_USER` / `SMTP_PASS` | no | Credenciales del servidor SMTP, si las exige |
| `MAIL_FROM` | no | Remitente que ven los usuarios (default `PATITAS <no-reply@patitas.local>`) |
| `R2_*` | no | Upload de imágenes. Si faltan, `POST /api/uploads/presign` responde `503` diciendo cuál falta |

### Emails (verificación de cuenta y recuperación de contraseña)

El backend manda dos tipos de email con un enlace de un solo uso: verificar el email (24 h) y restablecer la contraseña (30 min). Los enlaces apuntan a `FRONTEND_URL`.

- **Desarrollo** (`NODE_ENV` distinto de `production`) sin `SMTP_HOST`: el email se imprime en la consola del backend, con el enlace incluido. No hace falta ningún servidor de correo. Con `NODE_ENV=test` no se imprime nada.
- **Con `SMTP_HOST`**: se envía por SMTP en cualquier entorno.
- **Producción sin `SMTP_HOST`**: `POST /api/auth/verify-email/resend` y `POST /api/auth/forgot-password` responden `503` con código `MAIL_NOT_CONFIGURED` y `details.missingEnvVars: ["SMTP_HOST"]`; el reenvío no gasta token ni cooldown. El registro igual responde `201` (el error se loguea) para no bloquear el alta.

El reenvío de verificación tiene un cooldown de 60 s por usuario (`429` `RESEND_COOLDOWN`, con `details.retryAfterSeconds`).

### `INTERNAL_API_KEY`

Es la clave que usan el Backend Principal y el Backend IA para reconocerse entre sí en las llamadas server-to-server, donde no hay usuario logueado ni JWT. **Tiene que tener el mismo valor en los dos servicios.**

Se usa en las dos direcciones, y las dos fallan cerrado si falta:

- **Node → Backend IA** (`POST /reports/{id}/embedding`): se manda en el header `X-Internal-Key`. Si no coincide, el Backend IA responde `401` y el reporte con imagen **se queda en `pending`** — el log lo dice explícitamente para que no se confunda con una caída del servicio.
- **Backend IA → Node** (`POST /api/notifications/internal/match`): lo valida `requireInternalKey`. Si falta, el match se guarda igual pero nadie recibe la notificación.

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

**Prisma es la única fuente de migraciones** para toda la base de datos, incluidas las tablas que también usa el Backend IA (`reports`, `report_embeddings`, `report_matches`). El Backend IA solo lee/escribe sobre esas tablas vía SQLAlchemy, sin generar sus propias migraciones (ver `../backend-ia/README.md`).

## Matching por similitud (issue #18)

`src/services/matching.service.ts` dispara (fire-and-forget) la generación de embedding en Backend IA al crear un reporte con imagen, y expone `GET /api/reports/:id/matches` para listar los candidatos que Backend IA ya calculó y guardó en `report_matches`. El cálculo de embeddings/similitud en sí vive en `../backend-ia` (ver su README).

### Reportes atascados en `pending`

Un reporte con imagen nace `pending` y solo pasa a `published` (o `rejected`) cuando llega el veredicto del Backend IA. Los reintentos de ese disparo viven en memoria y se agotan en ~36s, así que si el Backend IA estuvo caído más que eso —o si el proceso de Node se reinició con la llamada en vuelo— el reporte se quedaba en `pending` para siempre: invisible en el feed, sin embedding y sin poder matchear.

`reconcilePendingReports()` es la red de contención: al levantar el server y cada 5 minutos vuelve a disparar la generación de embedding para los reportes `pending` con imagen que ya pasaron el grace period de 2 minutos y siguen dentro de una ventana de 24 horas. Pasadas esas 24 horas se deja de insistir (una imagen borrada del storage no se arregla reintentando) y el reporte queda para revisión manual:

```sql
SELECT id, title, created_at FROM reports
WHERE status = 'pending' AND image_url IS NOT NULL
  AND created_at < now() - interval '24 hours';
```

Como todo el flujo depende de `AI_SERVICE_URL`, si esa variable no está seteada la reconciliación no hace nada (mismo criterio que el disparo original).
