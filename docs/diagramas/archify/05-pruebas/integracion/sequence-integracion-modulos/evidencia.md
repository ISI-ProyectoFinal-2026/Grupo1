# Evidencia — Pruebas de integración entre módulos

| Dato | Valor |
| --- | --- |
| Diagrama | `integracion-modulos.html` (fuente `candidate.json`) |
| Tipo Archify | `sequence` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`integracion-modulos.finalize.json`) |
| Secciones del informe | 1.3.3.4 Pruebas de integración entre módulos del sistema; 1.3.3.6; 2.3.2.2.11 |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `frontend/playwright.config.ts:19-79`, `frontend/e2e/fixtures.ts:34-97` | Navegador, frontend con `vite preview`, backend real y stub HTTP de IA; servicios externos simulados |
| `frontend/e2e/support/ai-stub-server.ts:1-63` | Stub HTTP: `analyze` responde 200; `embedding` responde 409 por defecto |
| `frontend/e2e/support/db.ts:28-31` | Publicación del reporte por SQL directo (atajo de la suite) |
| `backend/tests/e2e/report-lifecycle.e2e.test.ts:16-161` | Journey B1 |
| `backend/tests/e2e/ai-moderation.e2e.test.ts:14-181` | Journeys B2, B3, B3b y B4 |
| `backend/tests/e2e/flag-moderation.e2e.test.ts:12-138` | Journey B5 |
| `backend/tests/e2e/lifecycle-errors.e2e.test.ts:15-157` | Journey B6 |
| `backend/tests/e2e/helpers/ai-stub.ts:1-100`, `backend/tests/e2e/helpers/factories.ts:24-90` | Stub sobre `fetch`; registro, promoción de rol y limpieza |
| `backend/src/app.ts:26-59`, `backend/src/middlewares/auth.middleware.ts:31-119`, `backend/src/routes/report-flags.routes.ts:10-11`, `backend/src/services/matching.service.ts:34-61` | Módulos ejercitados |
| `backend-ia/tests/test_matching_service.py:175` | `_notify_match` reemplazado en pytest |
| [Corrida CI 41448272798](https://github.com/ISI-ProyectoFinal-2026/Grupo1/actions/runs/41448272798) | Suites aprobadas en `f518b9a` |

## Verificación por escenario

| Escenario | Módulos integrados reales | Simulado | Verificaciones | Estado |
| --- | --- | --- | --- | --- |
| F1 a F13 (UI) | Frontend, API, middleware, PostgreSQL | Backend IA (HTTP), R2, Nominatim, teselas OSM; publicación por SQL | Estado visible en la interfaz | Implementado; 23 tests aprobados en CI |
| B1 ciclo de vida | API, auth, servicios, Prisma, PostgreSQL | Backend IA (`fetch`); creación del `reportMatch` | 201 `pending`; `published`; notificaciones; 200 `confirmed`; `resolved` | Implementado; aprobado en CI |
| B2 a B4 fallas de IA | API, servicios, PostgreSQL | Backend IA con 422, `has_animal: false`, error de red y 500; temporizadores falsos en B4 | 422 sin persistir; `rejected` notificado; `pending` tras 3 intentos | Implementado; aprobado en CI |
| B5 roles y moderación | API, `requireRole`, PostgreSQL | Cambio de rol por Prisma (`promoteTo`) | 403 para usuario regular y dueño; 409; 200 con reporte `rejected`; 404 | Implementado; aprobado en CI |
| B6 errores | API, `requireInternalKey`, PostgreSQL | — | 401 sin clave o con clave incorrecta; 403; 404; 409 | Implementado; aprobado en CI |
| Backend y Backend IA reales juntos | — | — | — | Cobertura pendiente |

## Criterios aplicados

- Las flechas punteadas desde las suites hacia PostgreSQL son atajos de preparación de datos, no flujos del sistema.
- El journey B2 a B4 se representa en un solo bloque; cada variante figura en la tabla.
- No se representan duraciones de los tests.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
