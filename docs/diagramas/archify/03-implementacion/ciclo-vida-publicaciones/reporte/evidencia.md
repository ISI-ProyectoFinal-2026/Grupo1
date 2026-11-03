# Evidencia — D-39 Ciclo de vida de un reporte (ReportStatus)

| Dato | Valor |
| --- | --- |
| Diagrama | `reporte.html` (fuente `candidate.json`) |
| Tipo Archify | `lifecycle` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`review-2/reporte.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend/src/services/reports.service.ts` | create: status pending, update con foto nueva, visibilidad, assertCanResolve, close |
| `backend/src/services/matching.service.ts` | veredicto condicional, publishedAt, 422 → rejected |
| `backend/src/services/report-flags.service.ts` | denuncia → rejected |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| pending — en moderación por IA | Verificado en código | `backend/src/services/reports.service.ts:148-170`; `backend/src/services/reports.service.ts:218-227`; `backend/src/services/matching.service.ts:74-84` |
| published — visible en feed y mapa | Verificado en código | `backend/src/services/matching.service.ts:79-83`; `backend/src/services/reports.service.ts:112-120` |
| resolved — cerrado por el autor | Verificado en código | `backend/src/services/reports.service.ts:190-201`; `backend/src/services/reports.service.ts:256-272` |
| rejected — IA sin mascota o denuncia resuelta | Verificado en código | `backend/src/services/matching.service.ts:123-124`; `backend/src/services/report-flags.service.ts:82-83` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- `docs/informe/1-2-2-2-historias-y-flujos.md` (Figura 1.2.2-3) incluye el alta directa en `published` sin foto; en el commit analizado no existe.
- El borrado (`DELETE /api/reports/:id`) elimina la fila; no es un estado.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
