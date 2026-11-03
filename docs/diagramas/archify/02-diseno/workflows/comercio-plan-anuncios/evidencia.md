# Evidencia — D-15 Comercio: registro, plan Premium y publicación de anuncios

| Dato | Valor |
| --- | --- |
| Diagrama | `comercio-plan-anuncios.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`comercio-plan-anuncios.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend/src/routes/businesses.routes.ts` | ruta, requireAuth |
| `backend/src/services/businesses.service.ts` | create, P2002, subscribe, rama REJECTED, transacción |
| `backend/src/services/payments/fake-payment-provider.ts` | charge |
| `backend/src/services/payments/index.ts` | getPaymentProvider |
| `backend/src/services/business-plan.ts` | planPeriodStart |
| `backend/src/routes/business-ads.routes.ts` | requireVerifiedEmail |
| `backend/src/services/ads.service.ts` | create, assertCanActivate |
| `backend/src/routes/ads.routes.ts` | getAd y eventos |
| `backend/src/services/ad-serving.service.ts` | pickAd y getAdFor |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| POST /api/businesses — nace FREE, sin email verificado | Verificado en código | `backend/src/routes/businesses.routes.ts:9-11`; `backend/src/services/businesses.service.ts:62-80` |
| 409 conflicto — CUIT o comercio existente | Verificado en código | `backend/src/services/businesses.service.ts:81-93` |
| POST .../me/subscription — período MONTHLY o ANNUAL | Verificado en código | `backend/src/routes/businesses.routes.ts:15`; `backend/src/services/businesses.service.ts:150-162` |
| FakePaymentProvider — aprueba todo cobro | Verificado en código | `backend/src/services/payments/fake-payment-provider.ts:4-9`; `backend/src/services/payments/index.ts:7-14` |
| 402 pago rechazado — subscriptions REJECTED | Verificado en código | `backend/src/services/businesses.service.ts:164-167` |
| Plan PREMIUM — subscriptions APPROVED, plan_expires_at | Verificado en código | `backend/src/services/businesses.service.ts:169-185`; `backend/src/services/business-plan.ts:19-22` |
| POST .../me/ads — nace ACTIVE | Verificado en código | `backend/src/routes/business-ads.routes.ts:8-10`; `backend/src/services/ads.service.ts:70-76` |
| 403 o 409 — sin Premium, sin ubicación o 3 activos | Verificado en código | `backend/src/services/ads.service.ts:43-63` |
| GET /api/ads — feed o detalle, segmentado por radio | Verificado en código | `backend/src/routes/ads.routes.ts:9-12`; `backend/src/services/ad-serving.service.ts:56-108` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- Pagos: solo existe `FakePaymentProvider`; la rama 402 no es alcanzable con el proveedor actual. Estado de la funcionalidad: parcial.
- Edición de perfil, métricas, eventos de anuncios y comercios cercanos no se representan.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
