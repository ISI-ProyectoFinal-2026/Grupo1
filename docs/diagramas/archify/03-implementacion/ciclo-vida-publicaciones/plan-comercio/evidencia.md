# Evidencia — D-44 Ciclo de vida del plan de un comercio (BusinessPlan)

| Dato | Valor |
| --- | --- |
| Diagrama | `plan-comercio.html` (fuente `candidate.json`) |
| Tipo Archify | `lifecycle` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`plan-comercio.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend/src/services/businesses.service.ts` | create, subscribe |
| `backend/prisma/schema.prisma` | BusinessPlan |
| `backend/src/services/business-plan.ts` | getEffectivePlan |
| `backend/src/services/ad-serving.service.ts` | isPremiumActive |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| FREE — todo comercio nace FREE | Verificado en código | `backend/src/services/businesses.service.ts:62-80`; `backend/prisma/schema.prisma:347-352` |
| PREMIUM vigente — plan_expires_at futuro | Verificado en código | `backend/src/services/businesses.service.ts:169-185`; `backend/src/services/business-plan.ts:3-6` |
| PREMIUM vencido — se lee como FREE | Verificado en código | `backend/src/services/business-plan.ts:3-6`; `backend/src/services/ad-serving.service.ts:54` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- "PREMIUM vencido" es un estado calculado al leer (`getEffectivePlan`), no un valor del enum `BusinessPlan`.
- `subscriptions.status` (`APPROVED`/`REJECTED`) se escribe una sola vez y no tiene ciclo de vida.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
