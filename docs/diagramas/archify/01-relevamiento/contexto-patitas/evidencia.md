# Evidencia — PATITAS: diagrama de contexto

| Dato | Valor |
| --- | --- |
| Diagrama | `contexto-patitas.html` (fuente `candidate.json`) |
| Tipo Archify | `architecture` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`review-2/contexto-patitas.finalize.json`); sin cruces de relaciones tras reubicar dos actores |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `backend/prisma/schema.prisma:12-24`, `:63` | Base PostgreSQL con PostGIS y pgvector; enum `Role`; perfil `Business` 1:1 |
| `backend/src/routes/report-flags.routes.ts:10-11`, `backend/src/routes/ad-flags.routes.ts:8-9` | Moderación restringida a `moderador` y `admin` |
| `frontend/src/router.tsx:32-87` | Pantallas sin sesión, autenticadas y de moderación |
| `frontend/src/services/api.ts:23-33`, `frontend/src/hooks/useChatSocket.ts:59-62` | REST `/api` y Socket.IO desde la SPA |
| `backend/src/app.ts:40-53`, `backend/src/index.ts:12-21` | Backend principal: routers, HTTP y Socket.IO |
| `backend-ia/app/main.py:112-166`, `backend/src/services/matching.service.ts:112-119`, `backend-ia/app/services/matching_service.py:56-66` | Llamadas al Backend IA y aviso de match de vuelta |
| `backend/src/services/storage.service.ts:41-79`, `frontend/src/services/uploads.service.ts:41-48`, `backend-ia/app/services/embedding_service.py:31-51` | Cloudflare R2 (prefirmado, PUT directo, descarga) y escritura de embeddings |
| `backend/src/services/mail/index.ts:29-44`, `backend/src/services/mail/smtp-mail-sender.ts:13-25` | Servidor SMTP con nodemailer |
| `frontend/src/components/maps/OsmTileLayer.tsx:6-9`, `frontend/src/components/maps/LocationPicker.tsx:21-27` | Teselas de OpenStreetMap y Nominatim |
| `backend/src/services/payments/index.ts:7-14`, `docs/adr/0024-modelo-monetizacion.md:47` | Pago simulado; pasarela real proyectada |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Actores Visitante, Usuario registrado, Moderador / admin | Verificado | `schema.prisma:18-24`; `router.tsx:38-50`, `:75-78` |
| Comercio como perfil del usuario, no rol | Verificado | `schema.prisma:63`; ADR-0019 |
| SPA, Backend principal, Backend IA y PostgreSQL | Verificado | Fuentes de la tabla anterior |
| Cloudflare R2, SMTP, OpenStreetMap/Nominatim | Verificado | Fuentes de la tabla anterior |
| Pagos | Parcial: proveedor simulado interno, sin sistema externo | `payments/index.ts:7-14`; `fake-payment-provider.ts:4-9` |
| Pasarela de pago real | Proyectada (solo en tarjeta) | ADR-0024:47 |

## Criterios aplicados

- PATITAS se muestra con cuatro bloques internos; el detalle lógico está en `02-diseno/arquitectura-logica`.
- La pasarela de pago no se dibuja como sistema externo porque no existe; se aclara en la tarjeta "Pagos (parcial)".
- Redis, CDN y API Gateway de `docs/ARQUITECTURA.md` no se dibujan: no existen en el código.
- Revisión visual realizada sobre las capturas de `visual-check/` (2048×1320, tema claro): relaciones etiquetadas, sin cruces ni solapamientos.
