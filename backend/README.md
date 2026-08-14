# Backend Principal — Base de datos

Setup de base de datos para la issue "Configurar la base de datos con sus respectivos modelos y esquemas". Cubre modelos, esquema y migraciones para el **Backend Principal** (Node/Express/Prisma). El resto del backend (auth, rutas, WebSocket, etc.) queda fuera de esta issue.

## Variables de entorno

Crear un archivo `.env` en esta carpeta (no versionado) con:

```
DATABASE_URL=postgresql://patitas:patitas@localhost:5433/patitas
NODE_ENV=development

# Backend IA (issue #18 — matching por similitud). Si no está seteada, el
# trigger de generación de embedding simplemente no hace nada (no rompe
# la creación del reporte, ver src/services/matching.service.ts).
AI_SERVICE_URL=http://localhost:8000
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
