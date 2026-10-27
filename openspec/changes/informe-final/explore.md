# Exploration: adr-documentation-model — ADR inventory

Source: sdd-explore phase, 2026-10-21. Engram mirror: `sdd/adr-documentation-model/explore` (summary only; this file is the full record).
Authors: MA = Matías Alvarado, AD = Agustín Díaz, GV = Gabriel Valdivieso, FM = Franco Marín (see `docs/equipo/ROLES.md`).

## Current state

- `docs/adr/` does not exist (no template, no index).
- 64 PRs merged, 29 closed unmerged (~25 Dependabot). Sprint 0 POC spikes: issues #1–#4 (closed 2026-06-18/28).
- Baseline architecture doc: `d58c06e` (2026-08-07, MA). PDD: `2f22b1b` (2026-07-21, MA).
- Rationale written in the repo exists only in: `docs/pocs/*`, `docker/postgres/Dockerfile` header, PRs #54, #109, #148, #156, #158, #161, #164, #192, #193, #194, #205, issue #177. Everything else must come from the interview.

## DINOv2

No evidence anywhere (working tree, GitHub issues/PRs, commit search). Branch contents were not grepped. The only vision models in code are YOLOv8n (`yolov8n.pt`) and OpenCLIP ViT-B-32 `laion2b_s34b_b79k`. ADR C12 must ask the user; never state DINOv2 as fact.

## Candidate inventory

### Wave 0 — Foundations

| ID | Decision | Version | Evidence | Alternatives / chain | Responsables |
|---|---|---|---|---|---|
| C01 | Monorepo `frontend/ backend/ backend-ia/ docker/ docs/` | — | PR #45 (`80bc657`, 2026-08-07, MA), #46; PR body empty | none; thin | MA |
| C02 | Express 5 + TS, routes→controllers→services, central error handler, `app.ts` exported for supertest | express ^5.2.1, zod ^4.4.3, TS ^5.6.2; CI Node 24 | PR #48 (`4eec6dc`, 2026-08-10, FM) | docs say Node 20 (stale); AUDITORIA sec. B | FM |
| C03 | Single PostgreSQL with PostGIS + pgvector | PG 16; `vector(512)`; HNSW cosine; `geometry(Point,4326)` | PR #47 (`8f30a6c`, 2026-08-09, GV) | ARQUITECTURA lists Faiss or pgvector; docs say PG 15 (stale) | GV |
| C04 | Prisma as ORM and only migration source; raw SQL for PostGIS/pgvector; backend-ia SQLAlchemy without schema ownership | prisma ^5.20 (5.22.0) | `schema.prisma`; PR #47 | Prisma 7 / TS 7 Dependabot PRs (#87, #97, #84) closed | GV |
| C05 | Separate FastAPI AI service | Python 3.11, fastapi 0.115.0, uvicorn 0.52.3, pydantic 2.9.2 | ARQUITECTURA sec. 2; `poc_similitudes.md` left it open | AUDITORIA: no unnecessary microservices | AD, MA |
| C06 | Frontend stack; chain: setup merged → reverted → redone | React ^19.2.8, Vite ^8.2, TS ~6.0.2, Tailwind ^3.4.19, react-router-dom ^6.30.6 | #99/#100 (2026-08-18, GV, no reviewers) → revert #101 → #102; #142 (MA); #130 closed | docs say React 18 (stale) | GV, MA |
| C07 | zustand 5 (`persist`) + TanStack Query 5 + Axios (JWT interceptor) + zod | zustand ^5.0.15, react-query ^5.101.4, axios ^1.19 | #100/#102 (GV); #144 (AD) | AUDITORIA sec. G: JWT in localStorage acceptable for prototype | GV, AD |
| C08 | Cloudflare R2, presigned PUT, direct browser upload, 5 min expiry, MIME whitelist, 10 MB | @aws-sdk/client-s3 ^3.1109 | PR #54 (`49a05a4`, 2026-08-13, AD) | ARQUITECTURA: S3 / GCS as alternatives | AD |
| C09 | Leaflet + OSM, Nominatim reverse geocoding, PostGIS `ST_DWithin` | leaflet ^1.9.4, react-leaflet ^5 | `docs/pocs/poc_mapas` (issue #4, GV); #115 (AD); #146 (MA) | POC compares Google Maps / Mapbox / Leaflet+OSM; Nominatim not evaluated | GV, AD, MA |
| C10 | Git workflow; chain: `develop`→`main` → personal branches + PR + review + Conventional Commits | — | #45, #47 from `develop`; #52 (`8b84dc6`, 2026-08-12, MA); `docs/WORKFLOW.md` | #99 merged without review | MA |
| C11 | Postgres image; chain: `postgis/postgis:16-3.4` → `postgres:16-bookworm` + PGDG; host port 5433 | PG 16 | `8f30a6c`, `918704a` (2026-08-09, GV); `afd0d71` (2026-09-08, GV, PR #165; #164 superseded) | rationale in Dockerfile header | GV |

### Wave 1 — AI and domain

| ID | Decision | Version | Evidence | Alternatives / chain | Responsables |
|---|---|---|---|---|---|
| C12 | YOLO crop + OpenCLIP embedding ("Opción B"), CPU, models loaded at module level | ultralytics 8.3.28, yolov8n, open_clip_torch 2.24.0, ViT-B-32 laion2b_s34b_b79k, torch 2.13.0 | `poc_similitudes.md` (issue #1, AD); PR #56 (`356b011`, 2026-08-14, AD); `QA_IA_PIPELINE.md` §7 (~0.68 s/img) | POC: A (OpenCLIP only) vs B; other models not evaluated; DINOv2 no evidence | AD |
| C13 | Embedding dimension chain `vector(1536)` → `vector(512)` | 512 | `8f30a6c` (GV); PR #56 `3873b38` (AD), migration `20260813000000_fix_report_embedding_dimension` | empirical fix | GV → AD |
| C14 | Matching: cosine `<=>`, HNSW, threshold 0.75 (provisional), 5 km, 30 days, LIMIT 5, manual confirmation; chain L2 → cosine | 0.75 | PR #156 (`420f80b`, 2026-08-26, GV); `QA_IA_PIPELINE.md` §2.1/2.6; PR #192 (MA) | threshold uncalibrated; `POC_Similitudes.ipynb` cited but missing from repo | GV, AD, MA |
| C15 | Image moderation; divergence: POC chose CLIP zero-shot, code uses YOLO with 10 COCO labels (no rabbit/turtle) | — | `docs/pocs/poc_moderacion` (issue #3, FM); PR #58 (`2dcc66b`, AD); PR #195 (`64dd910`, `ee3f609`, GV) | no record of why code diverged from POC | FM, AD, GV |
| C16 | Moderation workflow: `pending` → IA verdict → `published`/`rejected`; user flags; roles; panel; owner-only visibility | role enum | #57 (FM); #193 (MA); #195 (GV); #191 (AD) | "comercio" intentionally not a role | FM, MA, GV, AD |
| C17 | Flyers; divergence: POC Jinja2 + Playwright HTML → `@napi-rs/canvas` PNG 1080×1920 | @napi-rs/canvas ^1.0.8 | `poc_flyers.md` (issue #2, MA); #159 (`925a068`, AD); #166 (AD); #192 (MA) | library change unrecorded | MA, AD |

### Wave 2 — Service integration

| ID | Decision | Evidence / chain | Responsables |
|---|---|---|---|
| C18 | Backend→IA integration, 5-step chain: Redis queue + callback plan (ARQUITECTURA) → fire-and-forget (#56) → retries then `rejected` (#109) → stays `pending` (#148) → reconcile every 5 min (#156, `4c0df93`). Redis deferred: issue #177 (open, low). #177 claims compose has Redis; it does not. | AD, MA, GV |
| C19 | `X-Internal-Key`: fail-open (#109, MA) → fail-closed + `ALLOW_INSECURE_INTERNAL` (#158, GV); IA→Node notification endpoint (#145, FM) | MA, GV, FM |
| C20 | backend-ia writes `report_embeddings`/`report_matches` directly in the shared DB; thin | AD |
| C21 | Socket.IO chat with JWT handshake, rooms, persisted messages, attachments (#117, AD; #157, FM; `QA_CHAT_REALTIME.md`) | AD, FM |
| C22 | Chat uniqueness chain: per user pair → per report (#192, MA, migration `20260928000000_chat_unique_per_report`) | MA |
| C23 | Notifications via REST polling every 30 s (#161, FM; #145; #153) | FM, MA |

### Wave 3 — Security and identity

| ID | Decision | Evidence / chain | Responsables |
|---|---|---|---|
| C24 | JWT + bcryptjs 12 rounds, anti-enumeration/timing (#60, GV; #114, FM) | GV, FM |
| C25 | Sessions chain: stateless JWT → DB-validated with `token_version` (#204, MA) | MA |
| C26 | Email verification + password reset, nodemailer SMTP, gates reports/uploads/chat not login (#204, MA) | MA |
| C27 | 2FA: own TOTP, AES-256-GCM, recovery codes, lockout, 72 h self-service reset (#205, MA) | MA |
| C28 | RBAC enum + `requireRole` checked in DB + seeded admin (#193, MA) | MA |
| C29 | Hardening: CORS, rate limits, helmet, `/health`, `TRUST_PROXY` (#109, MA; #201, AD) | MA, AD |
| C30 (optional) | Business plan not selectable via API/UI (#189, #168, MA) | MA |

### Wave 4 — Quality and delivery

| ID | Decision | Evidence / chain | Responsables |
|---|---|---|---|
| C31 | Test stack: Jest + supertest on real Postgres; Vitest + Testing Library; Playwright; pytest (#48, #161, #197, #168) | FM, AD, MA |
| C32 | 70% coverage floor enforced by tooling in backend/frontend, none in backend-ia (#194, FM; issue #42) | FM |
| C33 | CI: 4 jobs, Node 24, `npm ci --legacy-peer-deps`, Postgres from `docker/postgres`, Python 3.11 (`e54d6b5`, `1fe0803`, `9e97f7c`) | MA, AD |
| C34 | Snyk chain: non-blocking `|| true` (`4e2dcc1`, MA) → blocking on criticals (#207, FM, open) | MA, FM |
| C35 | Dependabot chain: added (`e54d6b5`) → removed (`f1844f2`, 2026-08-24, MA), no recorded reason | MA |
| C36 (thin) | Whole-frontend refactor #206 (AD), no reviewer; check whether stack choices changed | AD |

## Proposed ordering

Number ADRs by wave; within a wave, the original decision precedes its superseder. Write an old decision as `Reemplazada por ADR-XXXX` only if the team confirms it was a real decision. The reverted frontend setup (#99/#100) is a process note, not a technical ADR. C30 and C36 may be dropped.

## Interview questions (Spanish, one at a time, in order)

- C01 — En el PR #45 (7-ago-2026, Matías) se fijó la estructura `frontend/ backend/ backend-ia/ docker/ docs/` sin descripción. ¿Por qué un monorepo y por qué esos cuatro paquetes?
- C02 — El scaffold del backend (PR #48, Franco, 10-ago) usa Express 5 + TypeScript + Zod con capas routes/controllers/services. ¿Por qué Express 5 y no Fastify, NestJS u otro, y por qué esas capas?
- C03 — Se eligió PostgreSQL 16 con PostGIS y pgvector en la misma base (PR #47, Gabriel). ARQUITECTURA.md menciona también Faiss y la doc dice PG 15. ¿Por qué una sola base en lugar de una base vectorial aparte, y por qué PG 16?
- C04 — Prisma 5 es la única fuente de migraciones y backend-ia no gestiona esquema. Dependabot propuso Prisma 7 y se cerró. ¿Por qué Prisma y por qué se mantuvo en 5?
- C05 — El poc_similitudes dejó abierto si el matching sería un servicio independiente o integrado. ¿Por qué un servicio FastAPI separado en Python en lugar de hacerlo dentro del backend Node?
- C06 — El setup del frontend se mergeó sin reviewers (PR #99, 18-ago), se revirtió el mismo día (#101) y se rehizo en #102, que dice "a pedido mío". ¿Quién pidió el revert y por qué? ¿Y por qué React 19, Vite 8, Tailwind 3 y react-router 6 en lugar de Tailwind 4 o router 7?
- C07 — El frontend usa zustand (con `persist`), TanStack Query y Axios. La auditoría del 23-sep marca el JWT en localStorage como riesgo "aceptable para prototipo". ¿Por qué ese conjunto de librerías y por qué se aceptó guardar el JWT ahí?
- C08 — El PR #54 (Agustín, 13-ago) sube imágenes directo a R2 con URL firmada. ¿Por qué Cloudflare R2 en lugar de S3 o GCS, y por qué subida directa y no pasando por el backend?
- C09 — El POC de mapas (Gabriel) comparó Google Maps, Mapbox y Leaflet+OSM por costo y eligió Leaflet para el piloto en San Rafael. ¿Por qué se usa Nominatim para geocodificación inversa si no estaba en el POC?
- C10 — Los primeros PRs (#45, #47) se mergearon desde `develop`; el 12-ago (PR #52, Matías) se pasó a ramas personales permanentes. ¿Por qué se abandonó `develop`, y por qué ramas por persona en lugar de ramas por feature?
- C11 — El Dockerfile de Postgres pasó de `postgis/postgis:16-3.4` a `postgres:16-bookworm` el 8-sep (Gabriel), con la explicación en el header. ¿Querés que el ADR use esa explicación tal cual, y hay algo más que sumar (por ejemplo, por qué PG 16)?
- C12 — El POC eligió YOLO + OpenCLIP (opción B) y aclara que no se evaluaron otros modelos. ¿Por qué estos dos modelos y estos tamaños (yolov8n y ViT-B-32 laion2b)? Además mencionaste DINOv2: no encuentro rastro en código, docs, issues ni PRs. ¿Dónde se discutió y quedó descartado, o fue una idea no concretada?
- C13 — El esquema inicial tenía `vector(1536)` y el PR #56 (Agustín, 13-ago) lo cambió a 512. ¿Cómo se detectó la diferencia y por qué se resolvió ajustando la columna en vez de otro modelo?
- C14 — La similitud usaba distancia L2 y el PR #156 (Gabriel, 26-ago) la pasó a coseno. El umbral 0.75 es el punto medio del POC (65–85%) y está marcado como provisional. ¿Quién fijó 0.75, por qué ese valor, y por qué radio de 5 km y 30 días?
- C15 — El POC de moderación (Franco) eligió CLIP porque YOLO no detectaba conejos ni tortugas, pero el código usa YOLO con 10 clases COCO y sin conejo ni tortuga (PR #58 de Agustín y PR #195 de Gabriel). ¿Por qué se implementó YOLO y no CLIP? ¿Se aceptó esa limitación?
- C16 — Los reportes con imagen nacen `pending` hasta que la IA decide, y además hay denuncias de usuarios con un panel para moderadores. ¿Por qué un esquema híbrido (automático más manual) y no solo uno de los dos?
- C17 — El POC de flyers eligió una plantilla HTML con Jinja2 + Playwright, pero el PR #159 (Agustín, 2-sep) lo implementó con `@napi-rs/canvas` en el backend Node. ¿Por qué se cambió la herramienta y por qué PNG 1080×1920 en lugar de PDF?
- C18 — La arquitectura planteaba una cola Redis; después fue fire-and-forget (#56), reintentos que rechazaban (#109), reportes que quedan `pending` (#148) y reconciliación cada 5 min (#156). El issue #177 deja la cola en prioridad baja. ¿Por qué cada paso, y por qué se decidió no implementar la cola por ahora?
- C19 — La clave interna `X-Internal-Key` falló abierta en #109 y cerrada en #158 (Gabriel). ¿Por qué se aceptó primero el modo abierto en desarrollo y qué llevó al cambio?
- C20 — backend-ia escribe embeddings y matches directo en la base compartida en vez de devolverlos por HTTP. ¿Por qué esa decisión y qué riesgos aceptaron?
- C21 — El PR #117 (Agustín, 24-ago) usa Socket.IO con handshake JWT. ¿Por qué Socket.IO y no SSE o WebSocket puro?
- C22 — El chat era único por par de usuarios y el PR #192 (Matías, 28-sep) lo pasó a "por reporte". El QA del 2-sep dejó la decisión al equipo. ¿Qué criterio de producto se usó para elegir por reporte?
- C23 — Las notificaciones usan polling cada 30 s porque el socket solo emite dentro de la sala del chat (PR #161, Franco). ¿Por qué se descartó extender el socket, y por qué 30 s?
- C24 — Auth con JWT y bcryptjs de 12 rondas, con defensa contra enumeración y timing (PR #60, Gabriel). ¿Por qué JWT en lugar de sesiones con cookie, y por qué bcryptjs con 12 rondas?
- C25 — En #204 (Matías, 12-oct) las sesiones se validan contra la base con `token_version` en vez de JWT sin estado. ¿Qué problema los llevó a ese cambio?
- C26 — La verificación de email no bloquea el login pero sí crear reportes, subir imágenes y chatear (PR #204). ¿Por qué ese límite y por qué SMTP con nodemailer en lugar de un proveedor de mails por API?
- C27 — El 2FA implementa TOTP propio, sin librería, con reinicio de 72 h por autoservicio y sin intervención de admin (PR #205). ¿Por qué TOTP propio y no una librería, y por qué sin SMS ni soporte manual?
- C28 — El rol se guarda en la base y no en el JWT, y "comercio" no es un rol (PR #193). ¿Por qué ese diseño?
- C29 — Se agregaron CORS, rate limits y helmet en #109 y health checks en #201 (Agustín, 12-oct). ¿Por qué esos límites (auth 5/min, uploads 20/min, global 300/min) y por qué recién en esas fechas?
- C30 — (Opcional) El plan de un comercio no se elige por API (PR #189, Matías). ¿Querés registrar esto como ADR o es solo una corrección de seguridad?
- C31 — ¿Por qué los tests del backend corren contra Postgres real en vez de mocks, y por qué Jest, Vitest y Playwright?
- C32 — El piso de cobertura es 70% (PR #194, Franco) y aplicado por herramienta. ¿Por qué 70% y por qué no hay piso en backend-ia?
- C33 — El CI tiene cuatro jobs en Node 24 con `--legacy-peer-deps` (PR #109, #168, #197). ¿Por qué esa estructura y por qué se necesitó `--legacy-peer-deps`?
- C34 — Snyk empezó como no bloqueante (`|| true`, 10-ago) y el PR #207 (Franco, abierto) lo hace bloqueante para críticas. ¿Por qué empezó no bloqueante, y cuál es el criterio actual?
- C35 — Dependabot se agregó el 17-ago y se eliminó el 24-ago (Matías, "chore: eliminar dependabot"); se cerraron 29 PRs sin mergear, incluyendo saltos mayores como Prisma 7 y TS 7. ¿Qué motivó la eliminación?
- C36 — El PR #206 (Agustín, 14-oct) refactorizó todo el frontend sin reviewers. ¿Cambió alguna decisión técnica (librerías, estructura, rutas) que deba quedar en un ADR?

## Stale-doc drift

| Doc says | Code/CI shows |
|---|---|
| React 18 (ARQUITECTURA, README) | React ^19.2.8 |
| PostgreSQL 15, pgvector 0.5 | Postgres 16 |
| Node 20 LTS | CI on Node 24 |
| Redis queue and cache in stack | not implemented; not in compose |
| Dependabot active (`docs/githubactions/README.md`) | removed `f1844f2` |
| Compose with backend, IA and pgAdmin (README) | compose has Postgres only |
| CI with two jobs | four jobs |
| ARQUITECTURA: `openai` pretrained weights do not give 512 dims | unverified; ViT-B-32 outputs 512 regardless of weights — confirm before repeating |

## Risks

- Evidence gathered without local git in the explore agent (GitHub pages/Atom feeds); short SHAs and UTC day-level dates.
- `docs/pocs/POC_Similitudes.ipynb` is cited but absent; 0.75 threshold and POC metrics cannot be re-verified.
- ADR "Contexto" must come from code and PRs, not from the stale docs above.

## Next

`sdd-propose`. In interactive mode, offer the proposal question round first.
