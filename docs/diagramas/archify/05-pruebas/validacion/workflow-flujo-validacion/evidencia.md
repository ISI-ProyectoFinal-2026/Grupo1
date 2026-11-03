# Evidencia — Flujo de validación de una prueba

| Dato | Valor |
| --- | --- |
| Diagrama | `flujo-validacion.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`flujo-validacion.finalize.json`) |
| Secciones del informe | 1.3.3; 2.3.2.2.11 |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `.github/workflows/ci.yml:1-7` | Disparo en push y pull request a `main` |
| `.github/workflows/ci.yml:20-64`, `:96-162`, `:164-215` | PostgreSQL con la imagen del proyecto, migraciones Prisma, ejecución de cada herramienta y artefacto de Playwright ante fallo |
| `.github/workflows/ci.yml:43-52`, `:84-90` | Typecheck de backend (`src` y `tests`) y lint y typecheck de frontend |
| `backend/tests/e2e/helpers/factories.ts:24-58`, `backend/tests/e2e/helpers/ai-stub.ts:57-100`, `backend-ia/tests/conftest.py:16-29` | Datos únicos por corrida y dobles del Backend IA y de los modelos |
| `backend/tests/e2e/report-lifecycle.e2e.test.ts:50-69`, `backend/tests/e2e/ai-moderation.e2e.test.ts:97-109` | Aserciones sobre estado HTTP, filas en base y llamadas al stub |
| `backend/jest.config.js:28-32`, `frontend/vitest.config.ts:15-17` | Umbral de cobertura del 70 % que hace fallar el comando |
| `frontend/playwright.config.ts:24-31` | `forbidOnly`, un reintento en CI, trace y captura solo ante fallo |
| `frontend/e2e/fixtures.ts:92-96`, `frontend/e2e/global-setup.ts:3-10` | Borrado de los usuarios creados por cada test y de restos de corridas abortadas |
| [Corrida CI 41448272798](https://github.com/ISI-ProyectoFinal-2026/Grupo1/actions/runs/41448272798) | Los cuatro jobs con conclusión `success` en `f518b9a` |

## Verificación por elemento

| Paso | Estado | Evidencia |
| --- | --- | --- |
| Disparo por push o PR a `main` | Implementado | `ci.yml:3-7` |
| Cuatro jobs en paralelo | Implementado | `ci.yml:9-215` (sin `needs` entre jobs) |
| Base PostgreSQL efímera con migraciones | Implementado en `backend`, `e2e-ui` y `backend-ia` | `ci.yml:20-60`, `:107-138`, `:171-198` |
| Datos de prueba y dobles | Implementado | Fuentes citadas arriba |
| Aserciones | Implementado | Fuentes citadas arriba |
| Umbral de cobertura | Implementado en backend y frontend; Backend IA sin umbral | `jest.config.js:30-32`; `vitest.config.ts:17`; `ci.yml:215` |
| Limpieza de datos | Implementado en suites E2E y en `global-setup` | Fuentes citadas arriba |
| Reintento | Implementado solo en Playwright (1 en CI) | `playwright.config.ts:25` |
| Job fallido y artefacto `playwright-report` (7 días) | Implementado | `ci.yml:154-162` |
| Resultado aprobado | Verificado en la corrida 41448272798 | Log de la corrida |
| Procedimiento de corrección tras un fallo | No disponible | Sin documentación en el repositorio |

## Criterios aplicados

- El diagrama resume los cuatro jobs en un solo recorrido; las diferencias entre jobs figuran en las etiquetas y en esta tabla.
- El job `frontend` no usa base de datos; el job `backend-ia` no ejecuta typecheck ni lint.
- No se representan tiempos de ejecución.
- No se realizó revisión visual de capturas; solo los chequeos automatizados de Archify.
