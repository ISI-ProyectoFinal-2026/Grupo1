---
seccion: "1.3.1"
titulo: "Programación y documentación"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-22
---

# 1.3.1 Programación y documentación

## 1.3.1.1 Introducción

El código fuente vive en un monorepo con cuatro paquetes ejecutables y la carpeta de documentación ([ADR-0001](../adr/0001-monorepo-y-dos-backends.md)). La tabla resume cada paquete, sus tecnologías principales y la decisión que las respalda. Las versiones son las declaradas en `package.json` y `requirements.txt`.

| Paquete | Tecnologías y versión declarada | Decisión |
|---|---|---|
| `frontend/` | React ^19.2.8, Vite ^8.2.0, TypeScript ~6.0.2, Tailwind CSS ^3.4.19, React Router ^6.30.6; TanStack Query ^5.101.4, zustand ^5.0.15, Axios ^1.19.0; Leaflet ^1.9.4 | [ADR-0006](../adr/0006-stack-frontend.md), [ADR-0007](../adr/0007-estado-y-datos-frontend.md), [ADR-0009](../adr/0009-mapas-leaflet-osm-nominatim-postgis.md) |
| `backend/` | Express ^5.2.1, TypeScript ^5.6.2, Zod ^4.4.3, Prisma ^5.20.0, Socket.IO ^4.8.3 | [ADR-0002](../adr/0002-express-5-typescript-zod.md), [ADR-0004](../adr/0004-prisma-5-orm.md) |
| `backend-ia/` | FastAPI 0.115.0, SQLAlchemy 2.0.35, ultralytics 8.3.28, open_clip_torch 2.24.0, torch 2.13.0 | [ADR-0005](../adr/0005-fastapi-servicio-ia.md); ADR del pipeline de IA: Pendiente |
| `docker/` | Imagen de PostgreSQL 16 con PostGIS y pgvector | [ADR-0011](../adr/0011-imagen-docker-postgres.md) |

Fuente: `frontend/package.json`, `backend/package.json`, `backend-ia/requirements.txt`.

### Organización del código

- `backend/src/`: `routes`, `controllers`, `services`, `validators`, `middlewares`, `sockets`, `config`, `db`, `errors`, `constants` y `utils`. La estructura en capas la define el equipo ([ADR-0002](../adr/0002-express-5-typescript-zod.md)).
- `frontend/src/`: `pages`, `components`, `layouts`, `hooks`, `services`, `stores`, `lib`, `types`, `utils` y `workflows`.
- `backend-ia/app/`: `main.py`, `config.py`, `db.py`, `models.py`, `ml/` (pipeline de visión) y `services/` (embeddings, análisis de imagen y matching).

### Proceso de desarrollo

| Aspecto | Práctica | Fuente |
|---|---|---|
| Ramas | Una rama personal permanente por integrante; se permiten ramas cortas por tarea | [ADR-0010](../adr/0010-flujo-git-ramas-personales.md), [WORKFLOW](../WORKFLOW.md) |
| Integración | Pull request hacia `main`, aprobación de otro integrante y merge del autor | [WORKFLOW](../WORKFLOW.md) |
| Commits | Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`) | [WORKFLOW](../WORKFLOW.md) |
| Integración continua | 4 jobs en cada push y pull request a `main`: backend, frontend, e2e-ui y backend-ia (Node 24 y Python 3.11) | [`ci.yml`](../../.github/workflows/ci.yml) |
| Verificaciones | Backend: `typecheck`, `typecheck:tests` y Jest con cobertura. Frontend: `oxlint`, `tsc -b` y Vitest con cobertura. E2E: Playwright. IA: pytest con cobertura | [`ci.yml`](../../.github/workflows/ci.yml) |
| Esquema de base | Migraciones de Prisma aplicadas con `prisma migrate deploy` antes de las pruebas | [`ci.yml`](../../.github/workflows/ci.yml), [1.2.4](1-2-4-modelo-de-datos.md) |

Los resultados de las verificaciones se detallan en [1.3.3](1-3-3-pruebas.md).

## 1.3.1.2 Documentación

La documentación está en el repositorio y se versiona junto con el código. Las decisiones de arquitectura se registran como ADR ([índice](../adr/README.md)), y la fuente de este informe está en [`docs/informe/`](README.md).

| Documento | Contenido | Ubicación |
|---|---|---|
| README del repositorio | Descripción general, arquitectura y puesta en marcha | [`README.md`](../../README.md) |
| README por paquete | Variables de entorno y uso de cada paquete | [`backend/`](../../backend/README.md), [`frontend/`](../../frontend/README.md), [`backend-ia/`](../../backend-ia/README.md) |
| Arquitectura | Definición técnica de la plataforma (versión 1.0) | [`ARQUITECTURA.md`](../ARQUITECTURA.md) |
| Flujo de trabajo | Ramas, pull requests y commits | [`WORKFLOW.md`](../WORKFLOW.md) |
| Decisiones (ADR) | Una decisión por archivo, con responsables y referencias | [`docs/adr/`](../adr/README.md) |
| Equipo | Roles e historial de contribuciones | [`ROLES.md`](../equipo/ROLES.md) |
| Pruebas de concepto | POC de similitudes, flyers, mapas y moderación | [`docs/pocs/`](../pocs/poc_similitudes.md) |
| QA | Verificaciones de chat en tiempo real, pipeline de IA y CRUD de mascotas | [`QA_CHAT_REALTIME.md`](../QA_CHAT_REALTIME.md), [`QA_IA_PIPELINE.md`](../QA_IA_PIPELINE.md), [`QA_PETS_CRUD.md`](../QA_PETS_CRUD.md) |
| Auditoría | Auditoría integral del backend | [`AUDITORIA_INTEGRAL_BACKEND_2026-09-23.md`](../AUDITORIA_INTEGRAL_BACKEND_2026-09-23.md) |
| Automatizaciones | Workflows de GitHub Actions | [`docs/githubactions/README.md`](../githubactions/README.md) |
| Definición del proyecto | Documento PDD v1.0 | [`PDD v1.0.docx`](../pdd/PDD%20v1.0.docx) |

### Estado de actualización

- Varios documentos llevan la fecha de su elaboración o verificación (por ejemplo, `ARQUITECTURA.md` con fecha 2026-08-06) y pueden estar desactualizados respecto del código. Por ejemplo, el README del repositorio indica React 18 como versión del frontend, mientras que `frontend/package.json` declara React ^19.2.8.
- La revisión periódica de la documentación técnica la ejecuta el procedimiento `docs-review` (cada 14 días según [`.docs-review.json`](../.docs-review.json)), que compara el código con `docs/` y los ADR.
- Un dato que no puede respaldarse con un artefacto del repositorio figura como `No disponible`.
