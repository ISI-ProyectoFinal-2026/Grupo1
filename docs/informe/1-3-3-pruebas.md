---
seccion: "1.3.3"
titulo: "Planificación, ejecución y documentación de pruebas"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-22
---

# 1.3.3 Planificación, ejecución y documentación de pruebas

Los resultados de esta sección provienen de la última ejecución exitosa del workflow CI sobre `main`: [corrida 38512798771](https://github.com/ISI-ProyectoFinal-2026/Grupo1/actions/runs/38512798771), commit `8ff5c26`. Para obtenerla: `gh run list --workflow ci.yml --branch main --status success -L 1` y `gh run view 38512798771 --log`.

## 1.3.3.1 Objetivos y alcances

El objetivo es verificar de forma automática, en cada push y pull request a `main`, que los tres paquetes de código y el flujo completo de la interfaz funcionan ([`ci.yml`](../../.github/workflows/ci.yml)).

| Job de CI | Herramienta | Qué verifica | Tests | Cobertura |
|---|---|---|---|---|
| Backend (Node.js) | Jest + supertest | Servicios, rutas, middlewares, sockets y flujos contra PostgreSQL con las migraciones aplicadas | 929 en 63 suites | Sentencias 97,15 % (1809/1862); ramas 92,06 % (580/630); funciones 98,98 % (294/297); líneas 97,1 % (1778/1831) |
| Frontend (React) | Vitest + Testing Library | Componentes, hooks, servicios y rutas | 648 en 72 archivos | Sentencias 93,19 % (1302/1397); ramas 88,09 % (799/907); funciones 93,56 % (451/482); líneas 94 % (1223/1301) |
| Backend IA (Python) | pytest + pytest-cov | Servicios de embeddings, análisis de imagen y matching, y el endpoint de la API | 55 aprobados, 2 omitidos | Sentencias 92 % (229/249) |
| E2E UI (Playwright) | Playwright (Chromium) | Flujos de usuario completos en el navegador | 18 aprobados | No aplica |

Fuente: log de la [corrida 38512798771](https://github.com/ISI-ProyectoFinal-2026/Grupo1/actions/runs/38512798771) (commit `8ff5c26`, 2026-10-14). Los comandos de cada job están en `ci.yml`: `npm run test:coverage` (backend y frontend), `npm run test:e2e` (frontend) y `python -m pytest tests/ -v --cov=app` (backend-ia).

Backend y frontend fallan si la cobertura baja del 70 % en sentencias, ramas, funciones o líneas ([`jest.config.js`](../../backend/jest.config.js), [`vitest.config.ts`](../../frontend/vitest.config.ts)). Backend IA: umbral mínimo de cobertura No disponible (no figura en la configuración de pytest ni en el job).

## 1.3.3.2 Pruebas de validación de ingreso de datos

El backend valida las entradas con Zod en 12 archivos de [`backend/src/validators/`](../../backend/src/validators). Las pruebas de rutas verifican las respuestas de rechazo con estado 400: 21 archivos de `backend/tests/` lo aseguran, entre ellos [`auth.routes.test.ts`](../../backend/tests/auth/auth.routes.test.ts), [`reports.routes.test.ts`](../../backend/tests/reports/reports.routes.test.ts), [`pets.routes.test.ts`](../../backend/tests/pets/pets.routes.test.ts) y [`uploads.routes.test.ts`](../../backend/tests/uploads/uploads.routes.test.ts). La ejecución se incluye en los 929 tests del job de backend.

## 1.3.3.3 Prueba de lógica de los módulos principales

La lógica se prueba a nivel de servicio en `backend/tests/` (por ejemplo [`matching.service.test.ts`](../../backend/tests/matching/matching.service.test.ts), [`chats.service.test.ts`](../../backend/tests/chats/chats.service.test.ts), [`reports.service.test.ts`](../../backend/tests/reports/reports.service.test.ts), [`flyer.service.test.ts`](../../backend/tests/reports/flyer.service.test.ts) y las pruebas de TOTP en [`two-factor/`](../../backend/tests/two-factor)), en `frontend/` con Vitest y en [`backend-ia/tests/`](../../backend-ia/tests) para el pipeline y los servicios de IA. Las cifras están en 1.3.3.1.

## 1.3.3.4 Pruebas de integración entre módulos del sistema

- **Backend contra base real.** El job construye la imagen de PostgreSQL del proyecto, aplica las migraciones y ejecuta Jest. Las pruebas de extremo a extremo del backend están en [`backend/tests/e2e/`](../../backend/tests/e2e): ciclo de vida del reporte, moderación por IA, moderación de denuncias y errores del ciclo de vida.
- **Interfaz.** [`frontend/e2e/`](../../frontend/e2e) contiene 8 especificaciones (F1 a F8): registro, login y creación de reporte; coincidencia y notificación; denuncia y moderación; cierre de reporte; errores; verificación de email; recuperación de contraseña; segundo factor. La corrida registra 18 pruebas aprobadas en 33,9 s. Esta suite usa un stub del servicio de IA, por lo que el Backend IA real no participa ([`ci.yml`](../../.github/workflows/ci.yml)).
- **Backend IA contra base real.** El job levanta PostgreSQL y aplica las migraciones de Prisma antes de ejecutar pytest.

## 1.3.3.5 Pruebas de carga

No disponible (issue [#40](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/40), abierto). No hay mediciones de carga ni estimaciones en el repositorio.

## 1.3.3.6 Pruebas de seguridad por niveles de usuarios

- **Roles y autorización.** El backend define los roles `usuario_regular`, `moderador` y `admin` ([1.2.4](1-2-4-modelo-de-datos.md)). Las pruebas que los ejercitan incluyen [`auth.middleware.test.ts`](../../backend/tests/middlewares/auth.middleware.test.ts), [`report-flags.routes.test.ts`](../../backend/tests/report-flags/report-flags.routes.test.ts) y [`flag-moderation.e2e.test.ts`](../../backend/tests/e2e/flag-moderation.e2e.test.ts).
- **Cuenta y sesión.** Verificación de email ([`email-gate.routes.test.ts`](../../backend/tests/auth/email-gate.routes.test.ts)), validez de sesión ([`session.service.test.ts`](../../backend/tests/auth/session.service.test.ts)) y segundo factor (`two-factor.*.test.ts` en [`auth/`](../../backend/tests/auth)).
- **Limitación de tasa.** Pruebas globales ([`global-rate-limit.test.ts`](../../backend/tests/app/global-rate-limit.test.ts)) y por función (cuenta, 2FA, creación de reportes y flyers).

### Análisis de vulnerabilidades (Snyk)

| Medición | Antes | Después |
|---|---|---|
| Vulnerabilidades detectadas por Snyk | No disponible | No disponible |

No disponible hasta que se integre el pull request [#207](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/207) (abierto). El workflow de Snyk existe en [`snyk-security.yml`](../../.github/workflows/snyk-security.yml).
