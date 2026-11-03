# Evidencia — D-35 Alta de un reporte con foto

| Dato | Valor |
| --- | --- |
| Diagrama | `alta-reporte-con-foto.html` (fuente `candidate.json`) |
| Tipo Archify | `sequence` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`alta-reporte-con-foto.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend/src/middlewares/auth.middleware.ts` | requireVerifiedEmail |
| `frontend/src/components/reports/ImageUploader.tsx` | handleFileSelect |
| `frontend/src/components/reports/ReportForm.tsx` | handleSubmit |
| `backend/src/controllers/uploads.controller.ts` | presign y analyze |
| `backend/src/services/reports.service.ts` | create, transacción |
| `backend/src/services/matching.service.ts` | analyzeImage |
| `backend/src/services/storage.service.ts` | URL prefirmada |
| `backend-ia/app/main.py` | POST /images/analyze |
| `backend-ia/app/services/image_analysis_service.py` | _download |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Usuario — email verificado | Verificado en código | `backend/src/middlewares/auth.middleware.ts:104-119` |
| Frontend — ImageUploader, ReportForm | Verificado en código | `frontend/src/components/reports/ImageUploader.tsx:71-121`; `frontend/src/components/reports/ReportForm.tsx:100-118` |
| API Express — uploads, reports | Verificado en código | `backend/src/controllers/uploads.controller.ts:7-34`; `backend/src/services/reports.service.ts:131-188`; `backend/src/services/matching.service.ts:165-195` |
| Cloudflare R2 — bucket de imágenes | Verificado en código | `backend/src/services/storage.service.ts:63-79` |
| Backend IA — FastAPI, YOLO | Verificado en código | `backend-ia/app/main.py:131-146`; `backend-ia/app/services/image_analysis_service.py:37-52` |
| PostgreSQL — reports + PostGIS | Verificado en código | `backend/src/services/reports.service.ts:151-183` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- La consulta periódica del detalle y la moderación posterior se derivan a D-36.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
