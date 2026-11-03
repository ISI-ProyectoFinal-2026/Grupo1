# Evidencia — D-40 Ciclo de vida de una coincidencia (MatchStatus)

| Dato | Valor |
| --- | --- |
| Diagrama | `coincidencia.html` (fuente `candidate.json`) |
| Tipo Archify | `lifecycle` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`coincidencia.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend-ia/app/services/matching_service.py` | INSERT ... ON CONFLICT |
| `backend/prisma/schema.prisma` | MatchStatus |
| `backend/src/services/matching.service.ts` | UPDATE condicional, confirmMatch, rejectMatch, filtro en listMatches |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| pending — sugerida por el Backend IA | Verificado en código | `backend-ia/app/services/matching_service.py:142-154`; `backend/prisma/schema.prisma:218-224` |
| confirmed — el autor la reconoce | Verificado en código | `backend/src/services/matching.service.ts:387-401`; `backend/src/services/matching.service.ts:404-406` |
| rejected — el autor la descarta | Verificado en código | `backend/src/services/matching.service.ts:408-410`; `backend/src/services/matching.service.ts:351-352` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- La actualización de puntaje sobre una coincidencia `pending` no cambia de estado y no se dibuja como transición.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
