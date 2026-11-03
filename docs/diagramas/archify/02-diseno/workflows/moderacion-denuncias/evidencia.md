# Evidencia — D-13 Moderación comunitaria: denuncias de reportes y de anuncios

| Dato | Valor |
| --- | --- |
| Diagrama | `moderacion-denuncias.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`review-2/moderacion-denuncias.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `frontend/src/pages/reports/ReportDetailPage.tsx` | canFlag |
| `backend/src/routes/reports.routes.ts` | POST /:id/flags |
| `backend/src/validators/report-flags.validator.ts` | reason min 1 |
| `backend/src/services/report-flags.service.ts` | create, reportes, resolve reporte, updateMany condicional, report.update rejected |
| `backend/src/routes/ads.routes.ts` | requireAuth |
| `frontend/src/services/ads.service.ts` | flagAd |
| `backend/src/validators/ad-flags.validator.ts` | reason 1 a 500, action |
| `backend/src/services/ad-flags.service.ts` | create, anuncios, updateMany condicional, acción remove, acción dismiss |
| `backend/src/services/ads.service.ts` | getServableAd |
| `backend/src/routes/report-flags.routes.ts` | moderador, admin |
| `backend/src/routes/ad-flags.routes.ts` | moderador, admin |
| `frontend/src/router.tsx` | RequireRole |
| `frontend/src/pages/moderation/ModerationPage.tsx` | acciones |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Denuncia un reporte — FlagReportForm, motivo | Verificado en código | `frontend/src/pages/reports/ReportDetailPage.tsx:145`; `backend/src/routes/reports.routes.ts:50` |
| Alta en report_flags — solo published, no propio, única | Verificado en código | `backend/src/validators/report-flags.validator.ts:4-6`; `backend/src/services/report-flags.service.ts:16-45` |
| Denuncia un anuncio — POST /api/ads/:adId/flags | Verificado en código | `backend/src/routes/ads.routes.ts:13`; `frontend/src/services/ads.service.ts:42-44` |
| Alta en ad_flags — anuncio servible, no propio, única | Verificado en código | `backend/src/validators/ad-flags.validator.ts:4-6`; `backend/src/services/ad-flags.service.ts:22-37`; `backend/src/services/ads.service.ts:23-35` |
| 404, 403 o 409 — no visible, propio o repetida | Verificado en código | `backend/src/services/report-flags.service.ts:21-39`; `backend/src/services/ad-flags.service.ts:24-34` |
| Cola en /moderation — GET /api/report-flags y /api/ad-flags | Verificado en código | `backend/src/routes/report-flags.routes.ts:10-11`; `backend/src/routes/ad-flags.routes.ts:8-9`; `frontend/src/router.tsx:75-78` |
| PATCH de la denuncia — anuncios: remove o dismiss | Verificado en código | `backend/src/services/report-flags.service.ts:67-87`; `backend/src/validators/ad-flags.validator.ts:12-15`; `frontend/src/pages/moderation/ModerationPage.tsx:54-98` |
| 409 ya revisada — gana el primer moderador | Verificado en código | `backend/src/services/report-flags.service.ts:68-80`; `backend/src/services/ad-flags.service.ts:51-59` |
| Reporte rejected — denuncia reviewed | Verificado en código | `backend/src/services/report-flags.service.ts:82-83` |
| Anuncio REMOVED — denuncias pendientes a removed | Verificado en código | `backend/src/services/ad-flags.service.ts:61-68` |
| Denuncia dismissed — el anuncio sigue activo | Verificado en código | `backend/src/services/ad-flags.service.ts:48-52` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- El rechazo del reporte al resolver una denuncia no verifica el estado actual del reporte (`backend/src/services/report-flags.service.ts:82-83`).
- La primera ejecución de `finalize` (sin la arista de error de la denuncia de reporte) también aprobó; el HTML vigente corresponde a la segunda (`review-2/`).
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
