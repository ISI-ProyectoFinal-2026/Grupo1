# Drift notes, slice 16: `docs/ARQUITECTURA.md` §4 vs code

Input for the slice 13 drift ledger. Checked on 2026-10-24 against branch `matias/features`.

| Claim (ARQUITECTURA.md §4) | Source of truth | Verdict |
|---|---|---|
| 4.1 diagram: the main backend enqueues a job and the AI backend consumes it from a queue ("Cola", "Encolar job") | No queue exists. `triggerEmbeddingGeneration` calls `POST /reports/{id}/embedding` with `fetch` and does not await it (`backend/src/services/matching.service.ts:93-132`); periodic reconciliation covers stuck reports (`:198-255`). Queue tracked in #177 | Outdated: target design, not implemented (the §4.1 note says so, but the diagram does not) |
| 4.1: `POST /reports` answers "200 OK + ID report" | Controller answers 201 (`backend/src/controllers/reports.controller.ts:23`) | Wrong |
| 4.1: the report is always saved as "pendiente" | `pending` only when it has a photo; without a photo it is saved `published` (`backend/src/services/reports.service.ts:165`) | Incomplete |
| 4.1: the frontend uploads to R2 and gets the URL back | The frontend first requests a presigned URL from the API (`POST /api/uploads/presign`, `backend/src/services/storage.service.ts:63-79`), then `PUT`s to R2 | Incomplete |
| 4.1: no synchronous image check before saving | Early screening `POST /api/uploads/analyze` and a server re-check in `POST /api/reports` that answers 422 (`backend/src/controllers/uploads.controller.ts:17-25`, `backend/src/services/reports.service.ts:131-135`) | Missing from the document |
| 4.1 note: "no hay callback HTTP de vuelta a Backend Ppal" | The AI backend calls `POST /api/notifications/internal/match` (`backend-ia/app/services/matching_service.py:28-55`; route `backend/src/routes/notifications.routes.ts:14`) | Outdated |
| 4.2 step 4: the main backend "no espera ni usa el body" of the 201 | It does not use the body, but the status code is the moderation verdict: 201 → `published`, 422 → `rejected` (`backend/src/services/matching.service.ts:105-109`, `:73-90`) | Incomplete |
| 4.2: "Pendiente: notificar al usuario (no existe aún ruta/servicio de notifications)" | `notifications.service.ts` and `/api/notifications` exist; match, status-change and message notifications are created (`backend/src/services/notifications.service.ts:58`, `:151`, `:189`) | Outdated |
| 4.2 step 2: YOLO checks `is_pet(image)` | Any of the 10 COCO animal classes is accepted, including elephant, bear, zebra and giraffe (`backend-ia/app/ml/pipeline.py:22-33`, `:44-70`) | Imprecise |
| 4.2: fire-and-forget with no retries mentioned | Up to 3 attempts on network error or 5xx, waits of 1 s and 5 s (`backend/src/services/matching.service.ts:33`, `:45-68`), plus reconciliation every 5 min (`:198-203`) | Missing from the document |
| 4.3 step 3: "Pendiente: notificar al usuario ... y el flujo de confirmar/rechazar ... (hoy solo hay GET)" | Notification implemented (`backend-ia/app/services/matching_service.py:141`); confirm and reject implemented (`backend/src/routes/reports.routes.ts:31-32`, `backend/src/services/matching.service.ts:302-339`) | Outdated |
| 4.1: match alert "si similitud > umbral" | The code keeps matches with similarity ≥ 0.75 (skips only `< SIMILARITY_THRESHOLD`) (`backend-ia/app/services/matching_service.py:118`) | Imprecise (> vs ≥) |
| 4.3 step 1 query (published, opposite type, 5 km geography, 30 days, cosine order, limit 5) | Matches `backend-ia/app/services/matching_service.py:96-105` | Correct |

Related code-comment drift found while checking (not in ARQUITECTURA.md): `backend/src/services/matching.service.ts:180-181` says the in-memory retries run out in about 36 s, but the loop at `:49-62` never uses the third delay (30 s) of `RETRY_DELAYS_MS`; the real waits are 1 s and 5 s.
