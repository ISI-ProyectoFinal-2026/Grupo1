# Evidencia — D-38 Suscripción de un comercio al plan Premium

| Dato | Valor |
| --- | --- |
| Diagrama | `suscripcion-premium.html` (fuente `candidate.json`) |
| Tipo Archify | `sequence` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`suscripcion-premium.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `frontend/src/router.tsx` | /businesses/plan |
| `frontend/src/pages/business/BusinessPlanPage.tsx` | planes y suscripción |
| `backend/src/routes/plans.routes.ts` | GET /api/plans |
| `backend/src/routes/businesses.routes.ts` | POST /me/subscription |
| `backend/src/services/businesses.service.ts` | subscribe |
| `backend/src/services/payments/fake-payment-provider.ts` | charge |
| `backend/src/services/payments/index.ts` | selección |
| `backend/prisma/schema.prisma` | BusinessPlan y SubscriptionStatus |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Dueño del comercio — usuario con perfil Business | Verificado en código | `frontend/src/router.tsx:66` |
| Frontend — BusinessPlanPage | Verificado en código | `frontend/src/pages/business/BusinessPlanPage.tsx:36-75` |
| API Express — businesses.service | Verificado en código | `backend/src/routes/plans.routes.ts:6-9`; `backend/src/routes/businesses.routes.ts:15`; `backend/src/services/businesses.service.ts:150-186` |
| Proveedor de pago — FakePaymentProvider | Verificado en código | `backend/src/services/payments/fake-payment-provider.ts:4-9`; `backend/src/services/payments/index.ts:7-14` |
| PostgreSQL — businesses, subscriptions | Verificado en código | `backend/prisma/schema.prisma:347-366` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- Primera ejecución fallida en `validate` (`sequence/note-overlap`); se desplazaron mensajes sin cambiar orden ni contenido.
- Pasarela real no implementada: estado parcial.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
