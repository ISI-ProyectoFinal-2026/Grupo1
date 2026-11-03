# Evidencia — D-36 Moderación por IA y cálculo de coincidencias

| Dato | Valor |
| --- | --- |
| Diagrama | `moderacion-matching.html` (fuente `candidate.json`) |
| Tipo Archify | `sequence` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`moderacion-matching.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend/src/services/matching.service.ts` | triggerEmbeddingGeneration, applyModerationVerdict, reconciliación |
| `backend-ia/app/main.py` | POST /reports/{id}/embedding |
| `backend-ia/app/services/embedding_service.py` | process_report_image, descarga httpx |
| `backend-ia/app/services/matching_service.py` | matching y aviso |
| `backend/prisma/schema.prisma` | embeddings y matches |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| API Express — matching.service | Verificado en código | `backend/src/services/matching.service.ts:101-147`; `backend/src/services/matching.service.ts:74-98`; `backend/src/services/matching.service.ts:261-318` |
| Backend IA — FastAPI, YOLO + DINOv2 | Verificado en código | `backend-ia/app/main.py:112-128`; `backend-ia/app/services/embedding_service.py:24-61`; `backend-ia/app/services/matching_service.py:43-161` |
| Cloudflare R2 — imagen del reporte | Verificado en código | `backend-ia/app/services/embedding_service.py:31-35` |
| PostgreSQL — pgvector + PostGIS | Verificado en código | `backend/prisma/schema.prisma:204-242` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- Las ramas 422 y 201 son alternativas; se separan con segmentos.
- El participante PostgreSQL agrupa las escrituras de la API (Prisma) y del Backend IA (SQLAlchemy).
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
