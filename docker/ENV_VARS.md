# Variables de entorno — docker-compose (Postgres)

`docker-compose.yml` ya trae valores por defecto (`patitas`/`patitas`/`patitas`, puerto host `5433`), así que `docker compose up -d` funciona sin configuración extra para desarrollo local.

**Por qué 5433 y no 5432**: si ya tenés un PostgreSQL nativo corriendo en Windows/Mac/Linux escuchando en `5432`, el contenedor no puede publicar ahí (o peor, tus clientes se conectan silenciosamente al Postgres equivocado). Usamos `5433` como puerto de host por defecto para evitar ese choque; dentro del contenedor sigue siendo `5432`.

Para sobreescribirlos, crear un archivo `.env` (no versionado) en la raíz del repo (`Grupo1/.env`, junto a `docker-compose.yml`; Compose lo carga automáticamente) con:

```
POSTGRES_USER=patitas
POSTGRES_PASSWORD=patitas
POSTGRES_DB=patitas
POSTGRES_PORT=5433
```

El backend principal y el backend IA arman su propio `DATABASE_URL` a partir de estos mismos valores (ver `backend/.env.example` y `backend-ia/.env.example`).

---

## `INTERNAL_API_KEY` — clave compartida entre backend y backend-ia

**Tiene que tener el mismo valor en `backend/.env` y en `backend-ia/.env`.** No es un secreto de un servicio: es la contraseña que los dos usan para reconocerse entre sí.

```
# backend/.env  Y  backend-ia/.env — el MISMO valor en los dos
INTERNAL_API_KEY=dev-internal-key
```

Existe porque hay dos endpoints que se llaman servicio a servicio, sin usuario logueado de por medio, y por lo tanto sin JWT que valga:

| Dirección | Endpoint | Qué pasa si falta o no coincide |
|---|---|---|
| Node → Backend IA | `POST /reports/{id}/embedding` | El Backend IA responde `401`. El reporte con imagen **se queda en `pending`**: no se publica, no genera embedding y no matchea |
| Backend IA → Node | `POST /api/notifications/internal/match` | El Backend Principal responde `401`. El match se guarda igual, pero **nadie recibe la notificación** |

En desarrollo local podés poner cualquier string, mientras sea el mismo de los dos lados. En un entorno desplegado usá un valor generado al azar y no lo commitees.

### Los dos lados fallan cerrado

Si la variable no está configurada, **los dos servicios rechazan con `401`**. Es a propósito: `POST /reports/{id}/embedding` dispara inferencia de ML y escribe en la base, así que una configuración ausente tiene que dejarlo cerrado y no abierto (ver issue #106, donde una guarda que retornaba sin validar dejó el endpoint público durante semanas).

Para desarrollo local, si necesitás levantar el Backend IA sin configurar la clave, existe una escotilla que hay que pedir **explícitamente**:

```
# backend-ia/.env — SOLO desarrollo local, nunca en un entorno desplegado
ALLOW_INSECURE_INTERNAL=true
```

Con eso el endpoint atiende sin autenticar y el servicio loguea un warning en cada arranque. La diferencia con el comportamiento anterior es cuál es el default: antes, *no configurar nada* abría la puerta; ahora hay que escribir esa línea a mano.
