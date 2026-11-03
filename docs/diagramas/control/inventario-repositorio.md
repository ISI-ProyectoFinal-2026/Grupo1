# Inventario del repositorio

Relevamiento del repositorio PATITAS para preparar los diagramas de arquitectura. Solo incluye componentes verificados en archivos versionados al commit analizado.

> **Convención de evidencia:** cada afirmación cita `ruta:líneas` tal como existe en el commit `f518b9a`. Lo que proviene de documentación (docs/*.md, ADR, PDD) y no se encontró en el código se marca como "documentado, no verificado en código". Los archivos no versionados o ignorados no se atribuyen al commit; figuran en la sección 11.

## 1. Identificación del proyecto

| Dato | Valor |
| --- | --- |
| Commit analizado | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha del commit | 2026-11-02 09:52:47 -0300 |
| Mensaje | "Merge pull request #250 from ISI-ProyectoFinal-2026/dbeagus/features" |
| Rama | `main`, sincronizada con `origin/main` |
| Remoto | `origin` https://github.com/ISI-ProyectoFinal-2026/Grupo1.git |
| Archivos versionados | 667 (`git ls-files`) |
| Tags | Ninguno (`git tag` vacío) |
| Historial | 403 commits en total; 299 sin merges, de los cuales 275 siguen el formato Conventional Commits (`tipo(alcance): ...`) |
| Cambios locales pendientes (no versionados) | ` M .claude/skills/documentacion/SKILL.md`; `?? docs/diagramas/` (andamiaje de diagramas, incluye este archivo) |
| Stashes | 4 (no forman parte del commit) |

## 2. Tecnologías y dependencias

Versiones declaradas como rango en los manifiestos (`^`, `~`) o fijadas (`==`). No se verificaron las versiones efectivamente resueltas en los lockfiles.

### 2.1 Backend principal (`backend/package.json`)

| Tecnología | Versión | Manifiesto:línea |
| --- | --- | --- |
| Express | ^5.2.1 | `backend/package.json:34` |
| Prisma Client / Prisma CLI | ^5.20.0 | `backend/package.json:30`, `:52` |
| Zod | ^4.4.3 | `backend/package.json:40` |
| Socket.IO | ^4.8.3 | `backend/package.json:39` |
| jsonwebtoken | ^9.0.3 | `backend/package.json:37` |
| bcryptjs | ^3.0.3 | `backend/package.json:31` |
| helmet | ^8.3.0 | `backend/package.json:36` |
| cors | ^2.8.6 | `backend/package.json:32` |
| express-rate-limit | ^8.6.2 | `backend/package.json:35` |
| nodemailer | ^10.0.12 | `backend/package.json:38` |
| @aws-sdk/client-s3 y s3-request-presigner | ^3.1109.0 | `backend/package.json:26-27` |
| @napi-rs/canvas | ^1.0.8 | `backend/package.json:29` |
| dotenv | ^17.4.2 | `backend/package.json:33` |
| TypeScript | ^5.6.2 | `backend/package.json:57` |
| Jest / ts-jest / supertest | ^30.4.2 / ^29.4.12 / ^7.2.2 | `backend/package.json:51`, `:54-55` |
| ts-node | ^10.9.2 | `backend/package.json:56` |

### 2.2 Frontend (`frontend/package.json`)

| Tecnología | Versión | Manifiesto:línea |
| --- | --- | --- |
| React / React DOM | ^19.2.8 | `frontend/package.json:26-27` |
| React Router DOM | ^6.30.6 | `frontend/package.json:29` |
| TanStack Query | ^5.101.4 | `frontend/package.json:22` |
| zustand | ^5.0.15 | `frontend/package.json:32` |
| axios | ^1.19.0 | `frontend/package.json:23` |
| socket.io-client | ^4.8.3 | `frontend/package.json:30` |
| Leaflet / react-leaflet | ^1.9.4 / ^5.0.0 | `frontend/package.json:24`, `:28` |
| Zod | ^4.4.3 | `frontend/package.json:31` |
| qrcode.react | ^4.2.0 | `frontend/package.json:25` |
| Vite | ^8.2.0 | `frontend/package.json:56` |
| TypeScript | ~6.0.2 | `frontend/package.json:55` |
| Tailwind CSS | ^3.4.19 | `frontend/package.json:54` |
| Vitest / @vitest/coverage-v8 | ^4.1.11 | `frontend/package.json:57`, `:46` |
| Testing Library (react, dom, jest-dom, user-event) | ^16.3.3 / ^10.4.1 / ^7.0.1 / ^14.6.7 | `frontend/package.json:36-39` |
| Playwright | ^1.63.0 | `frontend/package.json:35` |
| oxlint / Prettier | ^1.75.0 / ^3.9.6 | `frontend/package.json:49`, `:52` |

### 2.3 Backend IA (`backend-ia/requirements.txt`)

| Tecnología | Versión | Manifiesto:línea |
| --- | --- | --- |
| FastAPI | 0.115.0 | `backend-ia/requirements.txt:1` |
| Uvicorn | 0.52.3 | `backend-ia/requirements.txt:2` |
| SQLAlchemy / asyncpg / pgvector | 2.0.35 / 0.30.0 / 0.3.4 | `backend-ia/requirements.txt:3`, `:5-6` |
| Pydantic / pydantic-settings | 2.9.2 / 2.15.0 | `backend-ia/requirements.txt:7-8` |
| PyTorch / torchvision | 2.13.0 / 0.28.0 | `backend-ia/requirements.txt:11-12` |
| timm (DINOv2) | 1.0.28 | `backend-ia/requirements.txt:13` |
| ultralytics (YOLO) | 8.3.28 | `backend-ia/requirements.txt:14` |
| Pillow / httpx / numpy | 10.4.0 / 0.28.1 / 2.1.3 | `backend-ia/requirements.txt:15-17` |
| pytest / pytest-asyncio / pytest-cov | 8.3.3 / 0.24.0 / 5.0.0 | `backend-ia/requirements.txt:20-22` |

### 2.4 Base de datos e infraestructura

| Tecnología | Versión | Evidencia |
| --- | --- | --- |
| PostgreSQL | 16 (imagen `postgres:16-bookworm`) | `docker/postgres/Dockerfile:12` |
| PostGIS | paquete `postgresql-16-postgis-3` | `docker/postgres/Dockerfile:16`, `docker/postgres/init.sql:2` |
| pgvector | paquete `postgresql-16-pgvector` | `docker/postgres/Dockerfile:17`, `docker/postgres/init.sql:3` |
| Node.js en CI | 24 (CI) / 20 (Snyk) | `.github/workflows/ci.yml:35`, `.github/workflows/snyk-security.yml:27` |
| Python en CI | 3.11 | `.github/workflows/ci.yml:203` |
| MkDocs (sitio del informe) | según `requirements-docs.txt` | `mkdocs.yml`, `.github/workflows/publish-report.yml:37-47` |

## 3. Arquitectura identificada

Monorepo con tres aplicaciones y una base compartida. Relaciones verificadas:

| Origen | Destino | Mecanismo | Evidencia |
| --- | --- | --- | --- |
| Frontend (SPA React) | Backend principal | HTTP con Axios, `baseURL: "/api"`, token Bearer | `frontend/src/services/api.ts:24-30` |
| Frontend | Backend principal (chat) | Socket.IO cliente | `frontend/src/hooks/useChatSocket.ts:20`, `:59` |
| Servidor Vite (dev/preview) | Backend principal `localhost:3001` | Proxy de `/api` y `/socket.io` (ws) | `frontend/vite.config.ts:9-20`, `:34-41` |
| Backend principal | PostgreSQL | Prisma (`DATABASE_URL`, extensiones postgis y vector) | `backend/prisma/schema.prisma:12-16` |
| Backend principal | Backend IA | `fetch` a `POST /reports/{id}/embedding`, `/images/analyze`, `/images/embedding` con `AI_SERVICE_URL` e `INTERNAL_API_KEY` | `backend/src/services/matching.service.ts:102-122`, `:166-188`, `:208-216` |
| Backend IA | PostgreSQL | SQLAlchemy async (escribe `report_embeddings`, `report_matches`) | `backend-ia/app/services/embedding_service.py:45-51`, `backend-ia/app/services/matching_service.py:142-160` |
| Backend IA | Backend principal | `POST /api/notifications/internal/match` con `X-Internal-Key` (best-effort) | `backend-ia/app/services/matching_service.py:43-70`, `backend/src/routes/notifications.routes.ts:14` |
| Backend IA | URL de la imagen (R2) | Descarga por httpx | `backend-ia/app/services/embedding_service.py:31-35` |
| Backend principal | Cloudflare R2 | AWS SDK S3 (URL prefirmada, HEAD, PUT de flyers) | `backend/src/services/storage.service.ts:41-75`, `:133-164` |
| Backend principal | Servidor SMTP | nodemailer | `backend/src/services/mail/smtp-mail-sender.ts:17`, `backend/src/services/mail/index.ts:18-42` |
| Frontend | OpenStreetMap / Nominatim | Teselas y geocodificación inversa directa desde el navegador | `frontend/src/components/maps/OsmTileLayer.tsx:7`, `frontend/src/components/maps/LocationPicker.tsx:25` |

Capas del backend principal (patrón rutas → controladores → servicios → Prisma), verificadas por imports:

| Capa | Ubicación | Evidencia |
| --- | --- | --- |
| Arranque HTTP + Socket.IO + reconciliación periódica | `backend/src/index.ts` | `backend/src/index.ts:8-21` |
| Composición de middlewares y routers | `backend/src/app.ts` | `backend/src/app.ts:32-59` |
| Rutas (15 archivos) | `backend/src/routes/` | `backend/src/app.ts:4-17` |
| Controladores (14) → servicios | `backend/src/controllers/` | imports `../services/*` en cada controlador (p. ej. `backend/src/controllers/reports.controller.ts:2-5`) |
| Validación con Zod (15) | `backend/src/validators/` | p. ej. `backend/src/validators/uploads.validator.ts:4-13` |
| Servicios (34 archivos, incluye `mail/`, `payments/`, `two-factor/`) | `backend/src/services/` | listado `git ls-files backend/src/services` |
| Socket de chat | `backend/src/sockets/chat.socket.ts` | `backend/src/sockets/chat.socket.ts:113-180` |

Backend IA: FastAPI con `app/main.py` (endpoints), `app/services/` (embedding, análisis de imagen, matching) y `app/ml/` (pipeline YOLO + DINOv2, calidad). Evidencia: `backend-ia/app/main.py:55-166`, `backend-ia/app/ml/pipeline.py:24-25`, `:62-64`.

Frontend: router en `frontend/src/router.tsx:32-87`; 27 páginas, 36 hooks (sin tests), 14 servicios HTTP en `frontend/src/services/`, store de sesión con zustand persistido (`frontend/src/stores/auth.store.ts:15`).

## 4. Módulos y funcionalidades

| Módulo | Responsabilidad | Rutas backend | Servicio(s) | Páginas/componentes frontend | Evidencia | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| Autenticación y cuenta | Registro, login, verificación de email, recuperación de contraseña, `me` | `/api/auth/*` | `auth.service.ts`, `auth-tokens.service.ts`, `session.service.ts`, `mail/` | `pages/auth/*`, `GuestOnlyRoute`, `ProtectedRoute` | `backend/src/routes/auth.routes.ts:31-47`; `frontend/src/router.tsx:38-53` | Implementada |
| Segundo factor (2FA TOTP) | Alta, baja, códigos de recuperación, reinicio demorado | `/api/auth/2fa/*` | `two-factor/service.ts`, `two-factor/reset.ts`, `two-factor/crypto.ts` | `pages/account/SecurityPage`, `pages/auth/TwoFactorReset*` | `backend/src/routes/auth.routes.ts:33-41`; `frontend/src/router.tsx:49-50`, `:61` | Implementada |
| Mascotas | CRUD de mascotas del usuario | `/api/pets` | `pets.service.ts` | `pages/pets/*` | `backend/src/routes/pets.routes.ts:7-11`; `frontend/src/router.tsx:68-70` | Implementada |
| Subida de imágenes | URL prefirmada a R2 y análisis previo (animal, calidad) | `/api/uploads/presign`, `/api/uploads/analyze` | `storage.service.ts`, `matching.service.ts` | `services/uploads.service.ts` | `backend/src/routes/uploads.routes.ts:17`, `:29` | Implementada |
| Reportes (perdido/encontrado) | CRUD, listado, cierre, flyers, reportes similares | `/api/reports/*` | `reports.service.ts`, `flyer.service.ts`, `similar-reports.service.ts` | `pages/reports/*` | `backend/src/routes/reports.routes.ts:20-50`; `frontend/src/router.tsx:55-58` | Implementada |
| Moderación automática por IA | Publica o rechaza el reporte según detección; reconciliación de pendientes cada 5 min | (interna) | `matching.service.ts` | — | `backend/src/services/matching.service.ts:81-92`, `:253-315` | Implementada |
| Matching por similitud | Embedding DINOv2 + búsqueda pgvector/PostGIS; confirmación o rechazo por los dueños | `/api/reports/:id/matches*`; IA `POST /reports/{id}/embedding` | `matching.service.ts`; IA `embedding_service.py`, `matching_service.py` | `pages/reports/ReportDetailPage` (no verificado el componente exacto) | `backend/src/routes/reports.routes.ts:34-37`; `backend-ia/app/services/matching_service.py:80-161` | Implementada |
| Denuncias y moderación de reportes | Denunciar reporte; panel de moderador/admin | `/api/reports/:id/flags`, `/api/report-flags` | `report-flags.service.ts` | `pages/moderation/ModerationPage`, `RequireRole` | `backend/src/routes/report-flags.routes.ts:10-11`; `frontend/src/router.tsx:75-78` | Implementada |
| Geolocalización | Reportes cercanos y mapa (PostGIS) | `/api/geo/nearby`, `/api/geo/map` | `geo.service.ts` | `components/maps/*` | `backend/src/routes/geo.routes.ts:6-7`; `backend/src/services/geo.service.ts:32-40` | Implementada |
| Chat | Chat por reporte entre dos usuarios, en tiempo real | `/api/chats/*` + Socket.IO (`join_chat`, `leave_chat`, `send_message`) | `chats.service.ts` | `pages/chat/ChatPage`, `hooks/useChatSocket` | `backend/src/routes/chats.routes.ts:7-10`; `backend/src/sockets/chat.socket.ts:143-180` | Implementada |
| Notificaciones | Listado, lectura, borrado; endpoint interno de match | `/api/notifications/*` | `notifications.service.ts` | `components/notifications/*` | `backend/src/routes/notifications.routes.ts:8-14` | Implementada |
| Preferencias de notificación y ubicación | Preferencias, consentimiento y última ubicación | `/api/notification-preferences/*` | `notification-preferences.service.ts` | `pages/account/NotificationSettingsPage` | `backend/src/routes/notification-preferences.routes.ts:7-10` | Implementada |
| Comercios | Alta, perfil público, directorio, métricas, contacto | `/api/businesses/*` | `businesses.service.ts`, `business-plan.ts` | `pages/business/*` | `backend/src/routes/businesses.routes.ts:11-20`; `frontend/src/router.tsx:63-67` | Implementada |
| Plan Premium y pagos | Oferta de planes y suscripción con proveedor de pago simulado | `/api/plans`, `/api/businesses/me/subscription` | `config/plans.ts`, `payments/` (`FakePaymentProvider`) | `pages/business/BusinessPlanPage` | `backend/src/routes/plans.routes.ts:2-7`; `backend/src/services/payments/index.ts:7-13`; `backend/src/services/payments/fake-payment-provider.ts:5` | Parcial (pasarela real no implementada; `provider = "fake"`, `backend/prisma/schema.prisma:368`) |
| Anuncios (publicidad) | Gestión de anuncios del comercio, servicio por cercanía, eventos, denuncias | `/api/businesses/me/ads/*`, `/api/ads/*`, `/api/ad-flags/*`, `/api/reports/:id/nearby-businesses` | `ads.service.ts`, `ad-serving.service.ts`, `ad-events.service.ts`, `ad-flags.service.ts` | `components/ads/*`, `pages/business/BusinessDashboardPage` | `backend/src/routes/business-ads.routes.ts:9-14`; `backend/src/routes/ads.routes.ts:10-13`; `backend/src/routes/ad-flags.routes.ts:8-9` | Implementada |
| Salud del servicio | Liveness y conexión a base | `/health`, `/health/db`; IA `/health`, `/health/db` | — | — | `backend/src/routes/health.routes.ts:8-13`; `backend-ia/app/main.py:93-109` | Implementada |

## 5. Entidades y persistencia

Fuente de verdad del esquema: `backend/prisma/schema.prisma`. Prisma es la única fuente de migraciones; el Backend IA lee y escribe sin migrar (`backend/prisma/schema.prisma:1-5`).

| Tabla (modelo) | Columnas clave | Relaciones / FK | Evidencia |
| --- | --- | --- | --- |
| `users` (User) | email único, `password_hash`, `role` (enum `usuario_regular`, `moderador`, `admin`), `email_verified_at`, `token_version`, campos 2FA | 1:N con pets, reports, notifications, messages, flags; 1:1 con business y notification_preferences | `backend/prisma/schema.prisma:18-67` |
| `auth_tokens` | `type`, `token_hash` único, `expires_at`, `used_at` | `user_id` → users (CASCADE) | `backend/prisma/schema.prisma:69-95` |
| `two_factor_recovery_codes` | `code_hash`, `used_at` | `user_id` → users (CASCADE) | `backend/prisma/schema.prisma:99-110` |
| `pets` | especie, raza, color, `photo_urls[]`, `microchip_id` | `user_id` → users | `backend/prisma/schema.prisma:112-129` |
| `reports` | `report_type` (lost/found), `status` (pending/published/rejected/resolved), `location geometry(Point,4326)`, `image_url`, `custom_flyer_url` | `user_id` → users; `pet_id` → pets (opcional) | `backend/prisma/schema.prisma:131-178` |
| `report_embeddings` | `embedding vector(768)` | `report_id` único → reports (CASCADE) | `backend/prisma/schema.prisma:204-216` |
| `report_matches` | `similarity_score`, `status` (pending/confirmed/rejected) | `report_lost_id`, `report_found_id` → reports (CASCADE); único por par | `backend/prisma/schema.prisma:218-242` |
| `report_flags` | `reason`, `status` (pending/reviewed) | `report_id` → reports (CASCADE); `user_id` → users; único por par | `backend/prisma/schema.prisma:180-202` |
| `chats` | par de usuarios normalizado | `user_a_id`, `user_b_id` → users; `report_id` → reports (opcional); único (A, B, reporte) | `backend/prisma/schema.prisma:244-264` |
| `messages` | `content`, `image_url` | `chat_id` → chats; `sender_id` → users | `backend/prisma/schema.prisma:266-278` |
| `notifications` | `type`, `is_read` | `user_id` → users; `report_id` → reports (opcional) | `backend/prisma/schema.prisma:280-295` |
| `notification_preferences` | flags de aviso, `nearby_radius_km`, consentimiento, `location geometry` | PK = `user_id` → users (CASCADE) | `backend/prisma/schema.prisma:297-335` |
| `businesses` | `cuit` único, categoría, lat/long, `plan` (FREE/PREMIUM), `plan_expires_at` | `user_id` único → users | `backend/prisma/schema.prisma:337-413` |
| `subscriptions` | período, `amount_usd`, `provider`, `status` | `business_id` → businesses (CASCADE) | `backend/prisma/schema.prisma:354-386` |
| `ads` | título, cuerpo, imagen, `radius_km`, `status` | `business_id` → businesses (CASCADE) | `backend/prisma/schema.prisma:415-442` |
| `ad_flags` | `reason`, `status` | `ad_id` → ads (CASCADE); `user_id` → users | `backend/prisma/schema.prisma:444-468` |
| `ad_events` | `type` (impression/click), `placement` | `ad_id` → ads (CASCADE) | `backend/prisma/schema.prisma:470-497` |
| `business_events` | `type` (VIEW/CONTACT) | `business_id` → businesses (CASCADE); `user_id` → users (SET NULL) | `backend/prisma/schema.prisma:499-522` |

| Aspecto | Hallazgo | Evidencia |
| --- | --- | --- |
| Migraciones | 23 migraciones Prisma, de `20260809000000_init` a `20261101040000_add_ad_flags` | `backend/prisma/migrations/` |
| Índices espaciales y vectoriales | GIST sobre `reports.location`; HNSW `vector_cosine_ops` sobre `report_embeddings.embedding` | `backend/prisma/migrations/20260809000000_init/migration.sql:132`, `:138`; `backend/prisma/migrations/20260813000000_fix_report_embedding_dimension/migration.sql:7` |
| Cambio de dimensión del embedding | Migración a `vector(768)` (DINOv2) | `backend/prisma/migrations/20261014000000_dinov2_embedding_dimension/migration.sql` |
| Seeder | Un único seed: crea o actualiza el usuario `admin` verificado | `backend/prisma/seed.ts:9-24`; `backend/package.json:22-24` |
| Script de datos IA | Re-embedding de reportes existentes | `backend-ia/scripts/reembed_reports.py` (contenido no relevado en detalle) |
| Backups | No se encontraron scripts ni configuración de respaldo (`pg_dump`, `pg_restore`) | búsqueda `git grep` sin resultados en código |
| Volumen de datos local | Volumen Docker `postgres_data` | `docker-compose.yml:13-14`, `:21-22` |

## 6. Autenticación y autorización

| Elemento | Mecanismo | Evidencia |
| --- | --- | --- |
| Credenciales | Hash bcrypt con 12 rondas | `backend/src/services/auth.service.ts:15`, `:37` |
| Token de acceso | JWT firmado con `JWT_SECRET`, expiración `JWT_EXPIRY` (default `24h`), claims `sub`, `email`, `tv` | `backend/src/utils/jwt.ts:11-19` |
| Invalidación de sesiones | `token_version` en users, comparado con `tv` | `backend/prisma/schema.prisma:36-38`; `backend/src/middlewares/auth.middleware.ts:26-41` |
| `requireAuth` / `optionalAuth` | Bearer token validado contra la base | `backend/src/middlewares/auth.middleware.ts:31-69` |
| `requireRole(...)` | Rol leído de la base en cada request | `backend/src/middlewares/auth.middleware.ts:78-102` |
| `requireVerifiedEmail` | Exige email verificado para crear reportes, subir imágenes, chatear, 2FA y anuncios | `backend/src/middlewares/auth.middleware.ts:110-119`; uso en `backend/src/routes/reports.routes.ts:22-24`, `backend/src/routes/uploads.routes.ts:17`, `:29`, `backend/src/routes/chats.routes.ts:8`, `:10` |
| 2FA TOTP | Secreto cifrado con `TWO_FACTOR_ENCRYPTION_KEY`; bloqueo por intentos en base | `backend/prisma/schema.prisma:39-48`; `backend/src/services/two-factor/crypto.ts:4` |
| Roles | `usuario_regular`, `moderador`, `admin`. Moderación de reportes y anuncios restringida a `moderador`/`admin` | `backend/prisma/schema.prisma:18-24`; `backend/src/routes/report-flags.routes.ts:10-11`; `backend/src/routes/ad-flags.routes.ts:8-9` |
| Comercio | Perfil del usuario, no un rol (relación 1:1) | `backend/prisma/schema.prisma:63`, `:390`; `docs/adr/0019-comercio-perfil-no-rol.md` |
| Servicio a servicio | Header `X-Internal-Key` = `INTERNAL_API_KEY`, falla cerrado en ambos lados | `backend/src/middlewares/internal-auth.middleware.ts:10-19`; `backend-ia/app/main.py:57-82` |
| Socket.IO | Handshake con la misma validación de sesión | `backend/src/sockets/chat.socket.ts:119-140` |
| Frontend | Token persistido en zustand, inyectado por interceptor Axios; 401 cierra sesión; `RequireRole` solo oculta pantallas | `frontend/src/stores/auth.store.ts:15`; `frontend/src/services/api.ts:27-40`; `frontend/src/router.tsx:71-78` |

## 7. Integraciones

Nombres de variables obtenidos del código (los archivos `*.env.example` versionados no pudieron leerse por restricción de permisos del entorno; ver sección 11).

| Servicio | SDK / mecanismo | Variables | Evidencia |
| --- | --- | --- | --- |
| Cloudflare R2 (compatible S3) | `@aws-sdk/client-s3`, URL prefirmada (jpeg/png/webp, máx. 10 MB) | `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `backend/src/services/storage.service.ts:10-20`, `:41-75`; `backend/src/validators/uploads.validator.ts:4-13` |
| Backend IA (interno) | HTTP `fetch` | `AI_SERVICE_URL`, `INTERNAL_API_KEY` | `backend/src/services/matching.service.ts:102-116` |
| Backend principal desde IA | httpx | `NODE_BACKEND_URL`, `INTERNAL_API_KEY`, `ALLOW_INSECURE_INTERNAL`, `DATABASE_URL`, `SQL_ECHO` | `backend-ia/app/config.py:7-20` |
| Modelos de IA | ultralytics YOLO (`yolov8n.pt`), timm DINOv2 (`vit_base_patch14_dinov2.lvd142m`, 768 dims, 224 px); nitidez por umbral | — | `backend-ia/app/ml/pipeline.py:24-29`, `:62-64`; `backend-ia/app/ml/quality.py:11`, `:31-32` |
| SMTP | nodemailer; sin `SMTP_HOST` imprime en consola | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | `backend/src/services/mail/index.ts:8-42` |
| Pagos | Proveedor simulado `FakePaymentProvider` | `PAYMENT_PROVIDER`, `PREMIUM_MONTHLY_PRICE_USD`, `PREMIUM_ANNUAL_PRICE_USD` | `backend/src/services/payments/index.ts:7-13`; `backend/src/config/plans.ts:35-41` |
| OpenStreetMap / Nominatim | Teselas y reverse geocoding desde el navegador | — | `frontend/src/components/maps/OsmTileLayer.tsx:7`; `frontend/src/components/maps/LocationPicker.tsx:25` |
| Flyers | `@napi-rs/canvas`, PNG subido a R2 | — | `backend/src/services/flyer.service.ts:250-280` |
| Otras del backend | `JWT_SECRET`, `JWT_EXPIRY`, `FRONTEND_URL`, `TRUST_PROXY`, `PORT`, `TWO_FACTOR_ENCRYPTION_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | — | `backend/src/app.ts:22-33`; `backend/src/index.ts:10`; `backend/src/utils/jwt.ts:12-13`; `backend/prisma/seed.ts:9-10` |
| Frontend | `VITE_SOCKET_URL` | — | `frontend/src/hooks/useChatSocket.ts:20` |
| Snyk | CLI en CI | secreto `SNYK_TOKEN` | `.github/workflows/snyk-security.yml:20` |

## 8. Infraestructura y despliegue

| Elemento | Hallazgo | Evidencia |
| --- | --- | --- |
| Docker Compose | Un único servicio: `postgres` (puerto host 5433, healthcheck, volumen) | `docker-compose.yml:1-22` |
| Imagen de base | `postgres:16-bookworm` + PostGIS + pgvector; script de extensiones | `docker/postgres/Dockerfile:12-20`; `docker/postgres/init.sql:2-3` |
| Contenedores de aplicación | No hay Dockerfile para backend, frontend ni backend-ia | `git ls-files` (solo `docker/postgres/Dockerfile`) |
| Hosting / producción | Sin configuración versionada. Vite admite hosts de túnel (`trycloudflare`, `ngrok`) | `frontend/vite.config.ts:26` |
| Sitio del informe | MkDocs publicado en GitHub Pages por ejecución manual | `.github/workflows/publish-report.yml:3-68`; `mkdocs.yml` |

Workflows de CI/CD:

| Workflow | Disparador | Jobs y pasos | Evidencia |
| --- | --- | --- | --- |
| `CI` | push y PR a `main` | `backend`: Postgres en Docker, `npm ci`, typecheck (src y tests), `prisma migrate deploy`, `prisma generate`, Jest con cobertura | `.github/workflows/ci.yml:1-64` |
| | | `frontend`: `npm ci`, oxlint, typecheck, Vitest con cobertura | `.github/workflows/ci.yml:66-94` |
| | | `e2e-ui`: Postgres, migraciones, Playwright Chromium con stub de IA; reporte como artefacto ante falla | `.github/workflows/ci.yml:96-162` |
| | | `backend-ia`: Postgres, migraciones Prisma, Python 3.11, pytest con cobertura | `.github/workflows/ci.yml:164-215` |
| `Publish report` | `workflow_dispatch` | `build` (pytest de `tools/informe-site`, `mkdocs build --strict`) y `deploy` a GitHub Pages | `.github/workflows/publish-report.yml:1-68` |
| `Snyk Security` | push y PR a `main` | `snyk test` (falla ante críticas) en backend y frontend; `snyk code test` y `monitor` sin bloquear; SARIF a GitHub | `.github/workflows/snyk-security.yml:1-70` |

Versionado:

| Aspecto | Hallazgo | Evidencia |
| --- | --- | --- |
| Tags / releases | No existen | `git tag` vacío |
| Versión de paquetes | backend `0.1.0`, frontend `0.0.0` | `backend/package.json:3`; `frontend/package.json:4` |
| Convención de commits | Conventional Commits (275 de 299 commits sin merge la cumplen) | `docs/adr/0010-flujo-git-ramas-personales.md`; `git log` |
| Flujo de ramas | Ramas personales `<nombre>/features` con PR a `main` y revisión obligatoria | `docs/adr/0010-flujo-git-ramas-personales.md`; mensaje del commit analizado (PR #250 desde `dbeagus/features`) |

## 9. Seguridad y tratamiento de datos

| Control | Hallazgo | Evidencia |
| --- | --- | --- |
| Cabeceras HTTP | `helmet()` global | `backend/src/app.ts:32` |
| CORS | Origen único `FRONTEND_URL` (default `http://localhost:5173`), también en Socket.IO | `backend/src/app.ts:33`; `backend/src/sockets/chat.socket.ts:114-116` |
| Rate limiting global | 300 req/min por IP en `/api` | `backend/src/middlewares/rate-limit.ts:8`, `:14-21`; `backend/src/app.ts:40` |
| Rate limiting específico | 2FA, reportes similares, creación de reportes (por usuario), eventos de anuncios; auth, cuenta, uploads, análisis y flyers definidos en sus rutas | `backend/src/middlewares/rate-limit.ts:26-74`; `backend/src/routes/auth.routes.ts:10`, `:22`; `backend/src/routes/uploads.routes.ts:8`, `:20`; `backend/src/routes/reports.routes.ts:11` |
| Trust proxy | Configurable para que el limitador use la IP real | `backend/src/app.ts:29`; `backend/src/config/trust-proxy.ts` |
| Validación de entrada | Esquemas Zod por módulo | `backend/src/validators/` (15 archivos) |
| Subidas | Solo jpeg/png/webp, máx. 10 MB, URL prefirmada | `backend/src/validators/uploads.validator.ts:4-13`; `backend/src/services/storage.service.ts:10-12`, `:63-75` |
| Secretos en base | Tokens de mail y códigos de recuperación guardados como sha256; secreto TOTP cifrado | `backend/prisma/schema.prisma:79-110`, `:39-43` |
| Comparación segura de clave interna | `secrets.compare_digest` en IA | `backend-ia/app/main.py:81` |
| Minimización de datos en métricas | `ad_events` sin usuario ni coordenadas | `backend/prisma/schema.prisma:485-497` |
| Consentimiento de ubicación | Estado y fecha de consentimiento | `backend/prisma/schema.prisma:323-324` |
| Análisis de dependencias | Snyk en CI | `.github/workflows/snyk-security.yml:47-63` |

## 10. Testing

| Área | Framework | Archivos de test | Evidencia |
| --- | --- | --- | --- |
| Backend principal (unitario e integración) | Jest + ts-jest + supertest | 81 `*.test.ts` en `backend/tests/` (incluye 4 E2E y 1 de helpers) | `backend/jest.config.js:3-6`; `backend/package.json:51-55` |
| Backend principal (E2E de API) | Jest con stub de IA | 4 `*.e2e.test.ts` en `backend/tests/e2e/` | `backend/package.json:20`; `backend/tests/e2e/helpers/ai-stub.ts` |
| Frontend (unitario/componentes) | Vitest + jsdom + Testing Library | 99 `*.test.ts(x)` en `frontend/src/` | `frontend/vitest.config.ts:8-12` |
| Frontend (E2E UI) | Playwright (Chromium) | 13 specs `f1` a `f13` en `frontend/e2e/` | `frontend/playwright.config.ts:19-79` |
| Backend IA | pytest + pytest-asyncio | 8 `test_*.py` en `backend-ia/tests/` | `backend-ia/requirements.txt:20-22` |
| Herramientas del informe | pytest | 2 archivos en `tools/*/tests/` | `.github/workflows/publish-report.yml:39-40` |

| Mecanismo | Hallazgo | Evidencia |
| --- | --- | --- |
| Umbral de cobertura backend | 70 % global (statements, branches, functions, lines) | `backend/jest.config.js:30-32` |
| Umbral de cobertura frontend | 70 % global, proveedor v8 | `frontend/vitest.config.ts:13-18` |
| Cobertura backend IA | Reporte `--cov=app`, sin umbral configurado | `.github/workflows/ci.yml:215` |
| Pasos de test en CI | Jest, Vitest, Playwright y pytest en cada push/PR a `main` | `.github/workflows/ci.yml:62-64`, `:92-94`, `:150-152`, `:211-215` |
| Chequeo estático | Typecheck backend (src y tests), oxlint y typecheck frontend | `.github/workflows/ci.yml:43-52`, `:84-90` |

## 11. Observaciones y componentes pendientes de verificación

| # | Observación | Tipo | Evidencia |
| --- | --- | --- | --- |
| 1 | `docs/ARQUITECTURA.md` describe Redis como cola de trabajo y caché; no existe en código ni en dependencias. La propia sección 7 lo declara no implementado | Documentado, no verificado en código | `docs/ARQUITECTURA.md:85`, `:105-107`, `:584-588` |
| 2 | El diagrama de despliegue documentado (CDN Cloudflare, API Gateway, hosting AWS/GCP/Hetzner, dominio `patitas.app`) no tiene configuración versionada | Documentado, no verificado en código | `docs/ARQUITECTURA.md:109-112`, `:654-697` |
| 3 | `docs/ARQUITECTURA.md` menciona OpenCLIP; el código usa DINOv2 | Desfase documentación-código | `docs/ARQUITECTURA.md:694`; `backend-ia/app/ml/pipeline.py:25` |
| 4 | `README.md` indica `docker/.env.example` y `docker-compose exec backend`; ese archivo no está versionado y Compose solo define `postgres` | Desfase documentación-código | `README.md:45-52`; `docker-compose.yml:1-22` |
| 5 | Documentación de endpoint WebSocket `/ws/chat/:chat_id`; el código usa Socket.IO en `/socket.io` | Desfase documentación-código | `docs/ARQUITECTURA.md:543`; `frontend/vite.config.ts:15-19` |
| 6 | `backend-ia/benchmarks/` y `backend-ia/tests/benchmarks/` existen en disco sin archivos versionados (Git los reporta como ignorados); `backend-ia/yolov8n.pt` está ignorado por la regla `*.pt`. El índice de ADR remite a `backend-ia/benchmarks/` para cerrar ADR-0014 | Solo local, pendiente de verificación | `.gitignore:22`; `docs/adr/README.md:46-47` |
| 7 | Archivos `.env` locales (`backend/.env`, `backend-ia/.env`, raíz) ignorados; no se consultaron | Solo local | `.gitignore:6` |
| 8 | Los `*.env.example` versionados (`backend/`, `backend-ia/`, `frontend/`) no pudieron leerse por restricción de permisos del entorno; las variables se tomaron del código | Pendiente de verificación | `git ls-files` |
| 9 | Origen de los pesos YOLO en ejecución (descarga automática de ultralytics) no verificado | Pendiente de verificación | `backend-ia/app/ml/pipeline.py:24`, `:62` |
| 10 | No hay mecanismo de backup y restauración ni hosting productivo versionado | Ausente en el repositorio | Secciones 5 y 8 |
| 11 | Registro de comercio sin `requireVerifiedEmail` (decisión explícita en comentario) | Observación | `backend/src/routes/businesses.routes.ts:9-11` |
| 12 | Snyk Code y `snyk monitor` no bloquean el pipeline (`|| true`) | Observación | `.github/workflows/snyk-security.yml:53-63` |
| 13 | Node.js 24 en CI frente a Node.js 20.x en `README.md` y en Snyk | Inconsistencia de versiones | `.github/workflows/ci.yml:35`; `README.md:34`; `.github/workflows/snyk-security.yml:27` |
| 14 | `openspec/` y `tools/informe-*` son herramientas de documentación, no componentes del sistema | Observación | `openspec/config.yaml`; `tools/informe-docx/informe_docx.py` |
| 15 | Contenido de `docs/pdd/PDD v1.0.docx` y `dashboard_Grupo1.html` no relevado | Pendiente de verificación | `git ls-files` |
