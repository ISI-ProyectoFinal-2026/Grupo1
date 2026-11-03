# Evidencia — D-12 Búsqueda en el feed y consulta del detalle de un reporte

| Dato | Valor |
| --- | --- |
| Diagrama | `consulta-feed-detalle.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`consulta-feed-detalle.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `frontend/src/pages/reports/FeedPage.tsx` | filtros y consultas, listMapReports |
| `frontend/src/router.tsx` | ProtectedRoute |
| `backend/src/routes/reports.routes.ts` | ruta, optionalAuth |
| `backend/src/validators/reports.validator.ts` | listReportsQuerySchema |
| `backend/src/services/reports.service.ts` | list, condiciones de lista, visibilidad, 404 en vez de 403 |
| `backend/src/routes/geo.routes.ts` | ruta |
| `backend/src/services/geo.service.ts` | withinBounds, condiciones de mapa |
| `frontend/src/components/reports/MapView.tsx` | enlace del marcador |
| `frontend/src/pages/reports/ReportDetailPage.tsx` | permisos de la vista |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| FeedPage /reports — tipo, zona y fechas | Verificado en código | `frontend/src/pages/reports/FeedPage.tsx:28-60`; `frontend/src/router.tsx:51-57` |
| GET /api/reports — status=published | Verificado en código | `backend/src/routes/reports.routes.ts:20`; `backend/src/validators/reports.validator.ts:38-46`; `backend/src/services/reports.service.ts:72-100` |
| GET /api/geo/map — área visible, debounce 300 ms | Verificado en código | `backend/src/routes/geo.routes.ts:7`; `backend/src/services/geo.service.ts:45-51`; `frontend/src/pages/reports/FeedPage.tsx:54-60` |
| SELECT reports published — zona ILIKE, ST_Within | Verificado en código | `backend/src/services/reports.service.ts:81-98`; `backend/src/services/geo.service.ts:9-29` |
| Elige tarjeta o marcador — enlace a /reports/:id | Verificado en código | `frontend/src/components/reports/MapView.tsx:90` |
| GET /api/reports/:id — getVisibleById | Verificado en código | `backend/src/routes/reports.routes.ts:25`; `backend/src/services/reports.service.ts:112-120` |
| 404 no encontrado — pending o rejected ajeno | Verificado en código | `backend/src/services/reports.service.ts:114-119` |
| Detalle con acciones — autor: cerrar; otros: contactar, denunciar | Verificado en código | `frontend/src/pages/reports/ReportDetailPage.tsx:140-148` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- `docs/informe/1-2-2-2-historias-y-flujos.md` afirma que `GET /api/geo/map` no se usa; en el commit analizado la vista mapa lo consume (`frontend/src/pages/reports/FeedPage.tsx:54-60`).
- `GET /api/geo/nearby` existe pero no se verificó un consumidor en el frontend; no se representa.
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
