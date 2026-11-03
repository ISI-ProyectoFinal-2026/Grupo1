# Evidencia — D-41 Ciclo de vida de una denuncia de reporte (ReportFlagStatus)

| Dato | Valor |
| --- | --- |
| Diagrama | `denuncia-reporte.html` (fuente `candidate.json`) |
| Tipo Archify | `lifecycle` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`denuncia-reporte.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend/src/services/report-flags.service.ts` | create, resolve |
| `backend/prisma/schema.prisma` | ReportFlagStatus |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| pending — en la cola de moderación | Verificado en código | `backend/src/services/report-flags.service.ts:16-45`; `backend/prisma/schema.prisma:180-185` |
| reviewed — resuelta por moderador o admin | Verificado en código | `backend/src/services/report-flags.service.ts:67-87` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- Solo dos estados en el enum `ReportFlagStatus`.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
