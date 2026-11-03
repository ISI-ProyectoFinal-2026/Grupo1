# Evidencia — D-11 Coincidencias por similitud: cálculo, aviso y decisión

| Dato | Valor |
| --- | --- |
| Diagrama | `coincidencias-matching.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`coincidencias-matching.finalize.json`) |

## Fuentes

| Archivo | Elementos citados |
| --- | --- |
| `backend-ia/app/main.py` | POST /reports/{id}/embedding |
| `backend-ia/app/services/embedding_service.py` | process_report_image |
| `backend-ia/app/services/matching_service.py` | find_and_store_matches, umbrales, INSERT ... ON CONFLICT, _notify_match |
| `backend/src/routes/notifications.routes.ts` | requireInternalKey |
| `backend/src/services/notifications.service.ts` | createForMatch |
| `backend/src/routes/reports.routes.ts` | requireAuth, rutas de decisión |
| `backend/src/services/matching.service.ts` | listMatches, updateMany condicional, decideMatch |
| `backend/src/controllers/reports.controller.ts` | confirmMatch y rejectMatch |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Embedding DINOv2 — YOLO recorta, 768 dimensiones | Verificado en código | `backend-ia/app/main.py:112-128`; `backend-ia/app/services/embedding_service.py:24-51` |
| Busca candidatos — published, tipo opuesto, 5 km, 30 días | Verificado en código | `backend-ia/app/services/matching_service.py:73-130` |
| UPSERT report_matches — similitud coseno ≥ 0,45 | Verificado en código | `backend-ia/app/services/matching_service.py:39-40`; `backend-ia/app/services/matching_service.py:132-160` |
| Aviso interno de match — POST .../internal/match | Verificado en código | `backend-ia/app/services/matching_service.py:43-70`; `backend/src/routes/notifications.routes.ts:12-14`; `backend/src/services/notifications.service.ts:59` |
| GET /api/reports/:id/matches — sesión requerida, sin rechazadas | Verificado en código | `backend/src/routes/reports.routes.ts:28-34`; `backend/src/services/matching.service.ts:337-355` |
| Confirma o rechaza — POST .../matches/:matchId/confirm o /reject | Verificado en código | `backend/src/routes/reports.routes.ts:35-37`; `backend/src/controllers/reports.controller.ts:66-76` |
| confirmed o rejected — UPDATE condicional desde pending | Verificado en código | `backend/src/services/matching.service.ts:387-401` |
| 403, 404 o 409 — no autor, ajena o ya decidida | Verificado en código | `backend/src/services/matching.service.ts:365-399` |

Las relaciones, mensajes y transiciones se verificaron en los sitios de llamada o escritura citados por el elemento de origen.

## Limitaciones

- La notificación se dibuja como un nodo de la API; la creación de filas en `notifications` se verificó solo hasta `createForMatch` (`backend/src/services/notifications.service.ts:59`).
- Umbrales provisionales (issue #217).
- Las líneas citadas corresponden al árbol de trabajo, cuyo código coincide con el commit analizado (los cambios locales se limitan a `docs/diagramas/` y `.claude/skills/documentacion/SKILL.md`).
- No se generaron exportaciones SVG/PNG por línea de comandos: la CLI de Archify no las ofrece; el visor HTML permite exportarlas manualmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
