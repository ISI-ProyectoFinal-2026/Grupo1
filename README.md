# 🐾 PATITAS — Plataforma de búsqueda de mascotas

Aplicación web para reportar mascotas perdidas o encontradas, con **matching visual automático** por IA, moderación, chat entre usuarios y un directorio de comercios del rubro.

Documentación completa (informe y ADR): <https://isi-proyectofinal-2026.github.io/Grupo1/>

---

## Funcionalidades

| Módulo | Qué incluye |
|---|---|
| Autenticación y cuenta | Registro con verificación de email, recuperación de contraseña, segundo factor (2FA) con códigos de recuperación |
| Reportes | Alta de mascota perdida o encontrada, feed con filtros y vista de mapa, detalle, edición, cierre y "Mis reportes" |
| Mascotas | Registro de las mascotas propias para precargar reportes |
| IA y matching | Moderación automática de la foto (detección de animal y aviso de baja calidad), sugerencia de reportes similares y coincidencias por similitud visual y cercanía |
| Notificaciones | Avisos de coincidencias, cambios de estado y reportes cercanos, con preferencias por usuario |
| Chat | Conversación en tiempo real entre usuarios, por reporte |
| Flyers | Generación de un flyer imprimible del reporte |
| Moderación comunitaria | Denuncia de reportes y anuncios; panel de moderación para ocultar o descartar |
| Mapa y geolocalización | Pin en el mapa, búsqueda por zona y geocodificación inversa |
| Comercios | Directorio con mapa, perfil público, plan Premium, anuncios segmentados por ubicación y métricas |
| Administración | Asignación de roles (moderador, admin) con registro de auditoría |

El detalle de cada módulo, con sus flujos, reglas y limitaciones, está en [docs/informe/1-2-2-2-historias-y-flujos.md](docs/informe/1-2-2-2-historias-y-flujos.md).

---

## Arquitectura

Monorepo con dos backends ([ADR-0001](docs/adr/0001-monorepo-y-dos-backends.md)):

| Componente | Tecnología |
|---|---|
| Frontend (`frontend/`) | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Zod, Leaflet |
| Backend principal (`backend/`) | Node.js, Express 5, TypeScript, Zod, Prisma 5, Socket.IO |
| Backend IA (`backend-ia/`) | Python, FastAPI, YOLOv8n (detección), DINOv2 ViT-B/14 (embeddings de 768 dimensiones) |
| Base de datos | PostgreSQL con PostGIS y pgvector (Docker) |
| Almacenamiento de imágenes | Cloudflare R2 con URLs prefirmadas |
| Mapas | Leaflet + OpenStreetMap; geocodificación con Nominatim a través del backend |

Cada decisión técnica está registrada como ADR en [docs/adr/](docs/adr/README.md). La arquitectura general está en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

---

## Puesta en marcha local

### Demo con un solo comando (Docker)

Requiere solo Docker. Antes del primer arranque, copiar los `.env.example` y completarlos (las credenciales de R2 van en `backend/.env`):

```bash
cp backend/.env.example backend/.env
cp backend-ia/.env.example backend-ia/.env
docker compose up -d   # postgres, backend-ia, backend y frontend, en ese orden y con healthcheck
docker compose ps      # los cuatro servicios en estado healthy
```

| Servicio | URL en el host |
|---|---|
| Frontend (nginx, proxea `/api` y `/socket.io` al backend) | <http://localhost:5173> |
| Backend principal | <http://localhost:3001> |
| Backend IA | <http://localhost:8000> |

- El backend aplica las migraciones pendientes (`prisma migrate deploy`) cada vez que arranca.
- La imagen del Backend IA incluye los pesos de YOLOv8n y DINOv2: el servicio arranca sin red.
- Dentro de Compose, `INTERNAL_API_KEY` es la misma para los dos backends (default `dev-internal-key`); `DATABASE_URL`, `AI_SERVICE_URL` y los puertos se fijan en `docker-compose.yml`. Variables opcionales: [docker/ENV_VARS.md](docker/ENV_VARS.md).

Chequeo previo a la demo (R2, clave interna, Backend IA, teselas de OSM y SMTP, en menos de 30 s):

```bash
docker compose exec backend node dist/scripts/preflight.js
```

Termina con código distinto de 0 si algún chequeo falla. Fuera de Docker: `cd backend && npm run preflight`.

**Dependencias de red de la demo:**

| Recurso | Sin internet |
|---|---|
| Cloudflare R2 (fotos de los reportes) | La subida responde 503 y no se pueden crear reportes con foto |
| Teselas de OpenStreetMap | El mapa queda gris; el resto del recorrido funciona |
| Google Fonts | El frontend usa las fuentes del sistema |

### Desarrollo sin Docker

#### Requisitos

- Docker (para PostgreSQL)
- Node.js 24
- Python 3.11

#### 1. Base de datos

```bash
docker compose up -d postgres   # solo PostgreSQL + PostGIS + pgvector, en el puerto 5433
```

Variables opcionales de Compose: [docker/ENV_VARS.md](docker/ENV_VARS.md).

#### 2. Backend principal

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:deploy   # aplica las migraciones
npm run dev             # http://localhost:3001
```

Las variables de entorno (base, R2, email, 2FA, `AI_SERVICE_URL`, `INTERNAL_API_KEY`) están en [backend/README.md](backend/README.md).

#### 3. Backend IA

```bash
cd backend-ia
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000
```

Requiere las migraciones del backend principal aplicadas. Configuración en [backend-ia/README.md](backend-ia/README.md).

#### 4. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

#### Verificar que todo responde

| Endpoint | Qué indica |
|---|---|
| `GET :3001/health` | El backend responde; `ai` informa si `AI_SERVICE_URL` está configurada |
| `GET :3001/health/db` | La base de datos responde |
| `GET :3001/health/ai` | El Backend IA responde |
| `GET :8000/health` | El Backend IA responde (no usa base de datos) |

---

## Tests y calidad

| Componente | Comandos |
|---|---|
| Backend | `npm run typecheck`, `npm test`, `npm run test:coverage` (Jest, contra la base real) |
| Frontend | `npm run lint` (oxlint), `npm run typecheck`, `npm test` (Vitest), `npm run test:e2e` (Playwright) |
| Backend IA | `python -m pytest tests/` |

El CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) corre todo lo anterior en cada PR. La estrategia de pruebas está en [docs/informe/1-3-3-pruebas.md](docs/informe/1-3-3-pruebas.md).

---

## Estructura

```
Grupo1/
├── frontend/          # SPA en React
├── backend/           # API principal (Express + Prisma)
├── backend-ia/        # Servicio de IA (FastAPI)
├── docker/            # Configuración de PostgreSQL
├── docs/              # Informe, ADR, arquitectura y flujo de trabajo
├── openspec/          # Cambios especificados con SDD
├── tools/             # Generación del sitio y del .docx del informe
├── docker-compose.yml
└── mkdocs.yml         # Sitio de documentación (GitHub Pages)
```

---

## Cómo contribuir

Cada integrante trabaja en su rama personal (`{nombre}/features`) y abre un PR contra `main`; los commits siguen Conventional Commits. El detalle está en [docs/WORKFLOW.md](docs/WORKFLOW.md) y [ADR-0010](docs/adr/0010-flujo-git-ramas-personales.md).

---

**Proyecto Final 2026 — Ingeniería en Sistemas de Información, UTN Facultad Regional San Rafael**
Última actualización: 2026-11-23
