# Evidencia — Estructura de pruebas de PATITAS

| Dato | Valor |
| --- | --- |
| Diagrama | `estructura-pruebas.html` (fuente `candidate.json`) |
| Tipo Archify | `tree` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`estructura-pruebas.finalize.json`) |
| Secciones del informe | 1.3.3 Planificación, ejecución y documentación de pruebas; 2.3.2.2.11 Método de desarrollo, testing, capacitación, implementación y mantenimiento |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `.github/workflows/ci.yml:1-215` | Jobs `backend`, `frontend`, `e2e-ui`, `backend-ia`; typecheck y lint |
| `backend/jest.config.js:1-34`, `frontend/vitest.config.ts:8-33` | Herramientas, alcance de cobertura y umbral del 70 % |
| `frontend/playwright.config.ts:19-79` | Playwright, solo proyecto Chromium, reintentos y servidores |
| `backend-ia/tests/conftest.py:16-44` | Modelos YOLO y DINOv2 simulados |
| `git ls-files` sobre `backend/tests`, `frontend/src`, `frontend/e2e`, `backend-ia/tests`, `tools/*/tests` | Cantidad de archivos por carpeta y categoría |
| [Corrida CI 41448272798](https://github.com/ISI-ProyectoFinal-2026/Grupo1/actions/runs/41448272798) (commit `f518b9a`, 2026-11-02) | Resultados por job |
| `.github/workflows/publish-report.yml:40`, `.github/workflows/snyk-security.yml:48-51` | Pruebas de `tools/informe-site` y análisis Snyk |
| [Issue #40](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/40) (abierto) | Pruebas de carga y performance planificadas |

## Resultados verificables

Fuente: log de la corrida 41448272798 (`gh run view 41448272798 --log`), sobre el mismo commit analizado.

| Job | Resultado | Cobertura de código (sentencias) |
| --- | --- | --- |
| Backend (Node.js) | 81 suites, 1351 tests aprobados | 97,66 % (2347/2403) |
| Frontend (React) | 99 archivos, 935 tests aprobados | 95,31 % (2013/2112) |
| Backend IA (Python) | 77 aprobados, 2 omitidos | 93 % (276/298) |
| E2E UI (Playwright) | 23 aprobados | No aplica |

Las cifras de cobertura miden código ejecutado; no indican qué requerimientos quedan verificados.

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Suites `backend/tests`, `frontend/src`, `frontend/e2e`, `backend-ia/tests` | Implementadas; resultado verificado en CI | Corrida 41448272798 |
| Validación de ingreso (Zod, respuestas 400) | Implementada | `backend/tests/validators/`; 28 archivos de `backend/tests` contienen aserciones de estado 400; `frontend/src/types/validators/` |
| Seguridad y roles (`requireAuth`, `requireRole`, 2FA, sesión) | Implementada | `backend/tests/middlewares/auth.middleware.test.ts:188-230`; `backend/tests/auth/`; `frontend/src/components/RequireRole.test.tsx` |
| Limitación de tasa (429) | Implementada | 12 archivos de `backend/tests` con aserciones de estado 429 |
| Manejo de errores | Implementada | `backend/tests/middlewares/error-handler.test.ts`; `backend/tests/e2e/lifecycle-errors.e2e.test.ts`; `frontend/e2e/f5-errors.spec.ts` |
| Typecheck y lint | Implementado (pasos de CI) | `ci.yml:43-52`, `:84-90` |
| Snyk | Implementado; corrida 41448272870 con conclusión `success` | `snyk-security.yml`; cantidad de vulnerabilidades no registrada |
| `tools/informe-site` | Implementada; se ejecuta en `publish-report.yml` | Resultado de su última ejecución: no consultado |
| `tools/informe-docx` | Implementada; no la ejecuta ningún workflow | Sin resultado verificable |
| Pruebas de carga y rendimiento | Planificada (issue #40 abierto) | Sin pruebas ni mediciones en el repositorio |
| Prueba conjunta backend + Backend IA real | Cobertura pendiente | Ambas suites usan stub de IA; `_notify_match` simulado en `test_matching_service.py:175` |
| Modelos de IA reales | Cobertura pendiente en CI | `test_pipeline_real_model.py:21-24`: omitidas sin `RUN_REAL_MODEL_TESTS=1` |
| Navegadores distintos de Chromium | Cobertura pendiente | `playwright.config.ts:37` |

## Criterios aplicados

- Las categorías agrupan archivos por responsabilidad principal; un archivo puede ejercitar varias categorías (por ejemplo, una prueba de rutas que valida 400 y 403).
- Los conteos de archivos provienen de `git ls-files` en el commit analizado; los de tests, del log de CI.
- No se ejecutaron pruebas localmente.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
