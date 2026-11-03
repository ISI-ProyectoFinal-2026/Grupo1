# Evidencia — PATITAS: arquitectura lógica

| Dato | Valor |
| --- | --- |
| Diagrama | `arquitectura-logica.html` (fuente `candidate.json`) |
| Tipo Archify | `architecture` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`review-3/arquitectura-logica.finalize.json`); un cruce estructural informado |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `frontend/src/router.tsx:32-87`, `frontend/src/layouts/MainLayout.tsx:101-111` | Páginas y layout |
| `frontend/src/hooks/useReportDetailQuery.ts:8-9`, `frontend/src/hooks/useChatSocket.ts:56-62`, `frontend/src/stores/auth.store.ts:14-19` | Hooks con TanStack Query, cliente Socket.IO, store de sesión |
| `frontend/src/services/api.ts:23-45`, `frontend/src/services/uploads.service.ts:41-48` | Cliente Axios con Bearer; PUT a R2 |
| `backend/src/app.ts:29-53`, `backend/src/middlewares/auth.middleware.ts:31-119` | Middlewares globales y de autorización; montaje de routers |
| `backend/src/routes/reports.routes.ts:20-50`, `backend/src/controllers/reports.controller.ts:1-12` | Rutas → controladores → servicios y esquemas Zod |
| `backend/src/services/reports.service.ts:148-151`, `backend/src/db/client.ts:10-14`, `backend/prisma/schema.prisma:1-16` | Servicios de dominio y Prisma |
| `backend/src/sockets/chat.socket.ts:83-140` | Socket.IO: handshake con sesión y `send_message` usando servicios |
| `backend/src/services/matching.service.ts:101-125`, `backend/src/services/mail/index.ts:29-44`, `backend/src/services/payments/index.ts:7-14`, `backend/src/services/storage.service.ts:41-79`, `:153-173` | Integraciones: Backend IA, correo, pago simulado, R2 |
| `backend-ia/app/main.py:55-60`, `:112-166` | API FastAPI con `X-Internal-Key` |
| `backend-ia/app/services/embedding_service.py:24-61`, `image_analysis_service.py:78-97`, `matching_service.py:43-161` | Servicios IA, escritura en PostgreSQL, descarga de imagen y aviso de match |
| `backend-ia/app/ml/pipeline.py:24-28`, `:62-68`, `backend-ia/app/ml/quality.py:31-32` | Pipeline YOLOv8n + DINOv2 y nitidez |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Capas del frontend (páginas, hooks, servicios HTTP) | Verificado | Fuentes del frontend |
| Cadena middlewares → rutas → controladores → servicios → Prisma → PostgreSQL | Verificado | `app.ts:29-53`; `reports.controller.ts:1-12`; `db/client.ts:10-14` |
| Socket.IO usa servicios de chat y notificaciones | Verificado | `chat.socket.ts:5-7`, `:83-111` |
| Integraciones → R2, SMTP, Backend IA | Verificado | Fuentes de integraciones |
| Pagos | Parcial: `FakePaymentProvider` | `payments/index.ts:7-14` |
| Backend IA: API, servicios, pipeline; escritura en `report_embeddings` y `report_matches` | Verificado | Fuentes del Backend IA |
| Aviso de match al backend principal (best-effort) | Verificado | `matching_service.py:43-70`; `notifications.routes.ts:14` |

## Criterios aplicados

- Vista lógica: no incluye hosts, puertos, contenedores ni despliegue.
- Las integraciones (`storage`, `mail`, `matching.service`, `payments`) se agrupan en un bloque para mantener la legibilidad.
- Redis, cola de trabajos y API Gateway de `docs/ARQUITECTURA.md` no se dibujan: no existen en el código.
- El cruce entre "aviso de match" e "Integraciones → R2" es estructural: el Backend IA llama a la cadena del backend y R2 está conectado a ambos lados; se probó una reubicación que falló en `validate` y se restauró.
- Revisión visual realizada sobre las capturas de `visual-check/` (2048×1320, tema claro).
