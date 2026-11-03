# Evidencia — D-43 Ciclo de vida de una denuncia de anuncio (AdFlagStatus)

| Dato | Valor |
| --- | --- |
| Diagrama | `denuncia-anuncio.html` (fuente `candidate.json`) |
| Tipo Archify | `lifecycle` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`denuncia-anuncio.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend/src/services/ad-flags.service.ts` | create, resolve remove, resolve dismiss |
| `backend/prisma/schema.prisma` | AdFlagStatus |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| pending — en la cola de moderación | Verificado en código | `backend/src/services/ad-flags.service.ts:22-37`; `backend/prisma/schema.prisma:445-451` |
| removed — el anuncio se dio de baja | Verificado en código | `backend/src/services/ad-flags.service.ts:47-68` |
| dismissed — denuncia desestimada | Verificado en código | `backend/src/services/ad-flags.service.ts:48-52` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
