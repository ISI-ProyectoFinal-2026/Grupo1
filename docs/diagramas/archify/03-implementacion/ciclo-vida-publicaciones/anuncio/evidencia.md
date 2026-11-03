# Evidencia — D-42 Ciclo de vida de un anuncio (AdStatus)

| Dato | Valor |
| --- | --- |
| Diagrama | `anuncio.html` (fuente `candidate.json`) |
| Tipo Archify | `lifecycle` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`anuncio.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend/src/services/ads.service.ts` | create, assertCanActivate, setStatus, assertNotRemoved |
| `backend/src/services/ad-flags.service.ts` | acción remove |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| ACTIVE — se sirve si el plan Premium está vigente | Verificado en código | `backend/src/services/ads.service.ts:70-76`; `backend/src/services/ads.service.ts:43-63` |
| PAUSED — pausado por el dueño | Verificado en código | `backend/src/services/ads.service.ts:84-97` |
| REMOVED — baja por moderación | Verificado en código | `backend/src/services/ad-flags.service.ts:61-68`; `backend/src/services/ads.service.ts:37-41` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- El vencimiento del plan deja de servir el anuncio sin escribir su estado.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
