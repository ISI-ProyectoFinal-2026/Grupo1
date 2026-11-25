# Variables de entorno — docker-compose (Postgres)

`docker-compose.yml` ya trae valores por defecto (`patitas`/`patitas`/`patitas`, puerto host `5433`), así que `docker compose up -d postgres` funciona sin configuración extra para desarrollo local. El stack completo (`docker compose up -d`) necesita además `backend/.env` (al menos `JWT_SECRET`).

**Por qué 5433 y no 5432**: si ya tenés un PostgreSQL nativo corriendo en Windows/Mac/Linux escuchando en `5432`, el contenedor no puede publicar ahí (o peor, tus clientes se conectan silenciosamente al Postgres equivocado). Usamos `5433` como puerto de host por defecto para evitar ese choque; dentro del contenedor sigue siendo `5432`.

Para sobreescribirlos, crear un archivo `.env` (no versionado) en la raíz del repo (`Grupo1/.env`, junto a `docker-compose.yml`; Compose lo carga automáticamente) con:

```
POSTGRES_USER=patitas
POSTGRES_PASSWORD=patitas
POSTGRES_DB=patitas
POSTGRES_PORT=5433
```

El backend principal arma su `DATABASE_URL` a partir de estos mismos valores (ver `backend/.env.example`). El backend IA no se conecta a la base (ADR-0029).

### Servicios `backend`, `backend-ia` y `frontend`

Cada servicio lee su propio `.env` (`backend/.env`, `backend-ia/.env`) y Compose pisa los valores que cambian dentro de la red: `DATABASE_URL` (`postgres:5432`), `AI_SERVICE_URL` (`http://backend-ia:8000`), `REDIS_URL` (`redis://redis:6379`, cola del pipeline IA), `PORT`, `FRONTEND_URL`, `TRUST_PROXY=1` (el nginx del frontend es el proxy) e `INTERNAL_API_KEY`. Variables opcionales del `.env` de la raíz:

```
BACKEND_PORT=3001        # puerto del backend en el host
BACKEND_IA_PORT=8000     # puerto del Backend IA en el host
REDIS_PORT=6379          # puerto de Redis en el host
FRONTEND_PORT=5173       # puerto del frontend en el host (también arma FRONTEND_URL)
INTERNAL_API_KEY=dev-internal-key   # se inyecta igual en backend y backend-ia
VITE_SOCKET_URL=         # build arg del frontend; vacío = ruta relativa
```

Dentro de Compose, `INTERNAL_API_KEY` sale de este archivo y no de `backend/.env` ni de `backend-ia/.env`: así los dos servicios siempre reciben el mismo valor.

---

## `INTERNAL_API_KEY` — clave compartida entre backend y backend-ia

**Tiene que tener el mismo valor en `backend/.env` y en `backend-ia/.env`.** No es un secreto de un servicio: es la contraseña que los dos usan para reconocerse entre sí.

```
# backend/.env  Y  backend-ia/.env — el MISMO valor en los dos
INTERNAL_API_KEY=dev-internal-key
```

Existe porque el backend llama al Backend IA servicio a servicio, sin usuario logueado de por medio, y por lo tanto sin JWT que valga. Va en una sola dirección (el Backend IA no llama de vuelta al backend):

| Dirección | Endpoint | Qué pasa si falta o no coincide |
|---|---|---|
| Node → Backend IA | `POST /images/embedding` | El Backend IA responde `401`. El reporte con imagen **se queda en `pending`**: no se publica, no genera embedding y no matchea |
| Node → Backend IA | `POST /images/analyze` | El Backend IA responde `401`. El screening al subir la foto queda sin veredicto y el reporte sigue por la moderación asíncrona |

En desarrollo local podés poner cualquier string, mientras sea el mismo de los dos lados. En un entorno desplegado usá un valor generado al azar y no lo commitees.

### El Backend IA falla cerrado

Si la variable no está configurada, **el Backend IA rechaza con `401`**. Es a propósito: sus endpoints descargan imágenes y disparan inferencia de ML, así que una configuración ausente tiene que dejarlos cerrados y no abiertos (ver issue #106, donde una guarda que retornaba sin validar dejó el endpoint público durante semanas).

Para desarrollo local, si necesitás levantar el Backend IA sin configurar la clave, existe una escotilla que hay que pedir **explícitamente**:

```
# backend-ia/.env — SOLO desarrollo local, nunca en un entorno desplegado
ALLOW_INSECURE_INTERNAL=true
```

Con eso los endpoints atienden sin autenticar y el servicio loguea un warning en cada arranque. La diferencia con el comportamiento anterior es cuál es el default: antes, *no configurar nada* abría la puerta; ahora hay que escribir esa línea a mano.


---

## Email — `SMTP_*` y `MAIL_FROM` (solo `backend/.env`)

El backend manda emails de verificación de cuenta y de recuperación de contraseña. Las variables van en `backend/.env`; el detalle de comportamiento está en `backend/README.md`.

```
# backend/.env
SMTP_HOST=smtp.ejemplo.com   # vacío en desarrollo: los emails se imprimen en consola
SMTP_PORT=587                # 587 = STARTTLS (default)
SMTP_SECURE=false            # true solo con TLS directo (puerto 465)
SMTP_USER=                   # opcional si el servidor no pide autenticación
SMTP_PASS=
MAIL_FROM="PATITAS <no-reply@patitas.local>"
```

**En producción `SMTP_HOST` es obligatorio** para que funcionen el reenvío de verificación y la recuperación de contraseña: sin él ambos endpoints responden `503` `MAIL_NOT_CONFIGURED`. En desarrollo no hace falta: sin `SMTP_HOST` el backend imprime el email (con el enlace) en su consola; con `NODE_ENV=test` no imprime nada.

`FRONTEND_URL` define la base de los enlaces del email (`/verify-email?token=...`, `/reset-password?token=...`); el default es `http://localhost:5173`.

---

## Segundo factor (2FA) — `TWO_FACTOR_ENCRYPTION_KEY` (solo `backend/.env`)

El backend cifra el secreto TOTP de cada usuario con esta clave. El detalle está en `backend/README.md`.

```
# backend/.env
TWO_FACTOR_ENCRYPTION_KEY=   # openssl rand -base64 32
```

**En producción `TWO_FACTOR_ENCRYPTION_KEY` es obligatoria** (32 bytes en base64 o 64 caracteres hexadecimales): sin ella, activar o usar el 2FA responde `503` `TWO_FACTOR_NOT_CONFIGURED`; el login de cuentas sin 2FA sigue funcionando. En desarrollo y test, si falta, se deriva de `JWT_SECRET`.

Si se pierde o se cambia la clave, los secretos ya cifrados no se pueden descifrar y los usuarios con 2FA quedan sin poder pasar el segundo paso. Ellos mismos pueden pedir el reinicio por autoservicio de 72 h desde el login (el mail de confirmación necesita `SMTP_HOST` en producción y los links usan `FRONTEND_URL`); ese reinicio no necesita la clave. La otra salida es desactivarles el 2FA directo en la base.

---

## Backup — `BACKUP_*` y `SOURCE_IMAGES_BUCKET` (solo `backup/.env`)

El servicio `backup` (perfil `backup` de `docker-compose.yml`) hace el dump diario de la base y la copia incremental de las imágenes. El procedimiento completo, incluida la restauración, está en `docs/BACKUP.md`. Las variables van en `backup/.env` (copiar `backup/.env.example`):

```
# backup/.env
BACKUP_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
BACKUP_R2_ACCESS_KEY_ID=          # token con lectura/escritura sobre los DOS buckets
BACKUP_R2_SECRET_ACCESS_KEY=
BACKUP_R2_BUCKET=patitas-backups  # bucket exclusivo para backups
SOURCE_IMAGES_BUCKET=             # bucket de imágenes (= R2_BUCKET_NAME del backend)
BACKUP_HOUR=3                     # hora local diaria, 0-23 (default 3)
TZ=America/Argentina/Buenos_Aires # zona horaria de BACKUP_HOUR (sin TZ: UTC)
```

`DATABASE_URL` y `BACKUP_DIR` no van en `backup/.env`: `docker-compose.yml` los fija para el contenedor (`postgres:5432` con `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, y `/backups`). Solo hay que definirlos al correr el servicio fuera de Docker.

En el `.env` de la raíz, `BACKUP_HOST_DIR` define la carpeta del host donde quedan los dumps locales (default `../patitas-backups`, fuera del repo).

Si falta alguna variable obligatoria, el servicio no arranca y el log lista exactamente cuáles faltan. Sin el perfil `backup`, `docker compose up -d` no levanta este servicio y estas variables no hacen falta.
