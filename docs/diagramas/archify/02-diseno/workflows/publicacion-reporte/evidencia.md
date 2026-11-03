# Evidencia — D-10 Publicación de un reporte de mascota perdida o encontrada

| Dato | Valor |
| --- | --- |
| Diagrama | `publicacion-reporte.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`publicacion-reporte.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `frontend/src/components/reports/ImageUploader.tsx` | validación local, uploadToR2, screenImage |
| `backend/src/routes/uploads.routes.ts` | limiter y gates |
| `backend/src/services/storage.service.ts` | createPresignedUpload, assertR2Configured, PRESIGN_EXPIRY_SECONDS, buildObjectKey |
| `backend/src/controllers/uploads.controller.ts` | analyze |
| `backend/src/services/matching.service.ts` | analyzeImage, triggerEmbeddingGeneration, applyModerationVerdict |
| `frontend/src/components/reports/ReportForm.tsx` | imageRejection, navega al detalle |
| `backend/src/routes/reports.routes.ts` | requireVerifiedEmail + limiter |
| `backend/src/validators/reports.validator.ts` | createReportSchema |
| `backend/src/services/reports.service.ts` | create, assertImageHasAnimal, triggerModeration |
| `frontend/src/hooks/useReportDetailQuery.ts` | POLL_INTERVAL_MS |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Elige la foto — JPG, PNG o WebP hasta 10 MB | Verificado en código | `frontend/src/components/reports/ImageUploader.tsx:71-92` |
| POST /api/uploads/presign — email verificado, 20 por minuto | Verificado en código | `backend/src/routes/uploads.routes.ts:8-17`; `backend/src/services/storage.service.ts:63-79` |
| 503 almacenamiento — faltan variables R2_* | Verificado en código | `backend/src/services/storage.service.ts:30-39` |
| PUT directo a R2 — clave pets/<uuid>, URL 300 s | Verificado en código | `frontend/src/components/reports/ImageUploader.tsx:94-99`; `backend/src/services/storage.service.ts:7`; `backend/src/services/storage.service.ts:52-55` |
| POST /api/uploads/analyze — hasAnimal y lowQuality | Verificado en código | `backend/src/controllers/uploads.controller.ts:18-34`; `backend/src/services/matching.service.ts:165-195` |
| Envío deshabilitado — no se detectan animales | Verificado en código | `frontend/src/components/reports/ReportForm.tsx:73-83`; `frontend/src/components/reports/ImageUploader.tsx:44-54` |
| POST /api/reports — segundo control e INSERT pending | Verificado en código | `backend/src/routes/reports.routes.ts:22`; `backend/src/validators/reports.validator.ts:5-13`; `backend/src/services/reports.service.ts:148-188` |
| 422 sin animal — solo imágenes del bucket R2 | Verificado en código | `backend/src/services/reports.service.ts:131-135` |
| Detalle /reports/:id — se consulta cada 3 s mientras pending | Verificado en código | `frontend/src/components/reports/ReportForm.tsx:114-118`; `frontend/src/hooks/useReportDetailQuery.ts:4-13` |
| Moderación por Backend IA — 201 published, 422 rejected | Verificado en código | `backend/src/services/reports.service.ts:140-146`; `backend/src/services/matching.service.ts:101-147`; `backend/src/services/matching.service.ts:74-98` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- `docs/informe/1-2-2-2-historias-y-flujos.md` indica que sin foto el reporte nace `published`; en el commit analizado `imageUrl` es obligatorio (`backend/src/validators/reports.validator.ts:10`) y el reporte siempre nace `pending` (`backend/src/services/reports.service.ts:162`).
- La selección de ubicación (navegador y Nominatim) y las sugerencias de reportes similares (`POST /api/reports/similar`) no se representan.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
