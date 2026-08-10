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
