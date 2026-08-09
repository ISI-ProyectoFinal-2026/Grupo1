# Variables de entorno — docker-compose (Postgres)

`docker-compose.yml` ya trae valores por defecto (`patitas`/`patitas`/`patitas`, puerto `5432`), así que `docker compose up -d` funciona sin configuración extra para desarrollo local.

Para sobreescribirlos, crear un archivo `.env` (no versionado) en la raíz del repo (`Grupo1/.env`, junto a `docker-compose.yml`; Compose lo carga automáticamente) con:

```
POSTGRES_USER=patitas
POSTGRES_PASSWORD=patitas
POSTGRES_DB=patitas
POSTGRES_PORT=5432
```

El backend principal y el backend IA arman su propio `DATABASE_URL` a partir de estos mismos valores (ver `backend/.env.example` y `backend-ia/.env.example`).
