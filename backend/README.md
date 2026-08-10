# Backend Principal — Base de datos

Setup de base de datos para la issue "Configurar la base de datos con sus respectivos modelos y esquemas". Cubre modelos, esquema y migraciones para el **Backend Principal** (Node/Express/Prisma). El resto del backend (auth, rutas, WebSocket, etc.) queda fuera de esta issue.

## Variables de entorno

Crear un archivo `.env` en esta carpeta (no versionado) con:

```
DATABASE_URL=postgresql://patitas:patitas@localhost:5433/patitas
NODE_ENV=development
```

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

## Modelos

Ver `prisma/schema.prisma`. Mapea 1:1 el esquema documentado en `../docs/ARQUITECTURA.md` (sección 5): `users`, `pets`, `reports`, `report_embeddings`, `report_matches`, `chats`, `messages`, `notifications`.

**Prisma es la única fuente de migraciones** para toda la base de datos, incluidas las tablas que también usa el Backend IA (`reports`, `report_embeddings`). El Backend IA solo lee/escribe sobre esas tablas vía SQLAlchemy, sin generar sus propias migraciones (ver `../backend-ia/README.md`).
