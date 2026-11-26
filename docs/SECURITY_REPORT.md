# Reporte de seguridad — Análisis de vulnerabilidades

Issue: #41 · Fecha: 2026-10-14 · Commit base: `8ff5c26`

## Herramientas

| Herramienta | Alcance | Uso |
|---|---|---|
| `npm audit` | `backend`, `frontend` (dependencias Node) | Línea base y verificación posterior a los fixes |
| `pip-audit` + OSV.dev | `backend-ia` (dependencias Python) | Detección y resolución de severidad (GHSA) |
| Snyk Open Source (`snyk test`) | `backend`, `frontend` | Corrida local y gate en CI (`.github/workflows/snyk-security.yml`) |
| Snyk Code (`snyk code test`) | Código fuente de `backend`, `frontend` y `backend-ia` (SAST) | Corrida local; informativo en CI |

## Resultados

### Backend (Node)

| Severidad | Antes | Después |
|---|---|---|
| Crítica | 2 | **0** |
| Alta | 3 | **0** |
| Moderada | 4 | 20 |

Críticas corregidas con `npm audit fix` (solo lockfile, sin cambios de código):

- `handlebars` — inyección de JavaScript vía plantillas precompiladas.
- `proxy-addr` — IP spoofing vía subred IPv4-mapped IPv6 (afecta `req.ip` y los rate limiters).

Altas corregidas: `engine.io` (DoS), `brace-expansion` (DoS), `js-yaml` (DoS).

Las 20 moderadas restantes pertenecen a la cadena de testing (`jest`, `ts-jest` y transitivas). No se incluyen en el artefacto de producción. El fix que propone npm es un downgrade mayor (`jest@25`), por lo que no se aplicó.

### Frontend (Node)

| Severidad | Antes | Después |
|---|---|---|
| Crítica | 0 | **0** |
| Alta | 8 | 5 |
| Moderada | 4 | 4 |

Restantes (requieren upgrade mayor, no aplicado):

- `tailwindcss@3` y transitivas (`braces`, `micromatch`, `fast-glob`, `chokidar`, `postcss-*`): son herramientas de build, no corren en el navegador. Fix: Tailwind 4.
- `react-router-dom`: open redirect por backslash en `<Link>`/`useNavigate` (moderada). Fix: upgrade mayor.

### Backend IA (Python)

25 vulnerabilidades únicas, **ninguna crítica**: 16 altas, 8 moderadas, 1 baja.

| Paquete | Versión original | Altas | Moderadas | Bajas | Versión corregida | Aplicado en #321 |
|---|---|---|---|---|---|---|
| `pillow` | 10.4.0 | 13 | 4 | 0 | 12.3.0 | `pillow==12.3.0` |
| `starlette` | 0.38.6 | 3 | 3 | 1 | 1.3.1 | `starlette==1.10.0` (vía `fastapi==0.165.0`, que exige `starlette>=1.6.0`) |
| `pytest` | 8.3.3 | 0 | 1 | 0 | 9.0.3 | Pendiente (no incluido en #321) |

`fastapi` pasa de 0.115.0 a 0.165.0. Ambas versiones requieren Python >= 3.11, compatible con la imagen `python:3.11-slim` del `Dockerfile`. Verificación: `pytest` 77 pasados y 2 omitidos; con `RUN_REAL_MODEL_TESTS=1`, `test_pipeline_real_model.py` 2 pasados.

Defensa en profundidad del Backend IA (#321):

- `image_url` se valida contra `R2_PUBLIC_URL` antes de descargar (422 si no coincide o si la variable está vacía).
- `Image.MAX_IMAGE_PIXELS` fijado en 50.000.000 y `DecompressionBombWarning` tratada como error: las imágenes sobre el límite no se decodifican.

### Snyk Open Source

Sin críticas. Escaneo posterior a los fixes de la sección anterior.

| Paquete | Críticas | Altas | Medias | Detalle |
|---|---|---|---|---|
| `backend` | 0 | 1 | 0 | `zod@4.4.3` (consumo de recursos sin límite). Fix: `zod@4.6.6`. **Aplicado en #321: `zod@4.6.7`** (lockfile; `package.json` sin cambios) |
| `frontend` | 0 | 2 | 2 | `zod@4.4.3` (alta, **aplicado en #321: `zod@4.6.7`**); `react-router@6.30.6` (open redirect, alta; reflexión insegura, media); `leaflet@1.9.4` (XSS, media, sin fix disponible) |

`zod` no figuraba en `npm audit`: lo detectó solo Snyk.

### Snyk Code (SAST, backend)

Snyk Code no tiene nivel crítico; su máximo es HIGH. El escaneo dio 146 hallazgos; 57 están en `node_modules` (código de terceros, fuera de alcance) y 89 en código propio:

| Nivel | Cantidad | Detalle |
|---|---|---|
| Alto | 2 | `prisma/seed.ts:13` y `src/services/auth.service.ts:25` (ver abajo) |
| Medio | 2 | `src/controllers/chats.controller.ts:37` y `src/index.ts:9` |
| Bajo | 85 | Todos en tests (contraseñas y credenciales de prueba) |

- `src/services/auth.service.ts:25`: **falso positivo**. `DUMMY_HASH` es intencional y sirve para igualar el tiempo de `bcrypt.compare` cuando el email no existe.
- `prisma/seed.ts:13`: **válido**. Si no se define `SEED_ADMIN_PASSWORD`, el seed crea el usuario admin con una contraseña fija y conocida.
- `src/controllers/chats.controller.ts:37`: bajo riesgo. Interpola el `id` de la ruta en un `console.error`.
- `src/index.ts:9`: `http.createServer`. Es esperable si el TLS termina en el proxy (ver HTTPS).

### Snyk Code (SAST, frontend y backend-ia)

| Paquete | Archivos analizados | Altos | Medios | Bajos |
|---|---|---|---|---|
| `frontend` | todo el código TS/TSX | 0 | 4 | 32 |
| `backend-ia` | 17 archivos `.py` | 0 | 0 | 0 |

Frontend, hallazgos medios:

- `src/pages/auth/Register.tsx:32` y `src/pages/auth/ResetPasswordPage.tsx:50` (`NoCryptoTimingAttacks`): **falsos positivos**. Es la validación `password !== confirmPassword` del formulario; no compara un secreto contra un valor del servidor.
- 2 más en archivos de test (`HttpToHttps`, `Sqli`).
- Los 32 hallazgos bajos son contraseñas y credenciales de prueba en tests.

## HTTPS

- `helmet()` está activo en `backend/src/app.ts` y emite `Strict-Transport-Security`. Verificado por test: `backend/tests/app/health.test.ts` ("headers de seguridad (helmet)").
- `TRUST_PROXY` se interpreta en `backend/src/config/trust-proxy.ts` para obtener la IP real detrás del terminador TLS.
- **No hay redirección HTTP→HTTPS a nivel de aplicación.** La terminación TLS y la redirección corresponden al hosting/proxy inverso.
- `docs/DEPLOYMENT.md`, referenciado desde el README, no existe en el repositorio. No hay evidencia en el repo de un entorno desplegado sobre el cual verificar HTTPS de extremo a extremo.

## Verificación posterior a los fixes

- Backend: `tsc --noEmit` sin errores; Jest 63/63 suites, 929/929 tests.
- Frontend: Vitest 72/72 archivos, 648/648 tests; `npm run build` exitoso.

Revalidación en #321 (2026-11-26):

- Backend IA: `pytest` 77 pasados, 2 omitidos (`test_pipeline_real_model.py`, que requiere `RUN_REAL_MODEL_TESTS=1`); con esa variable, los 2 pasan.
- Frontend: Vitest 131/131 archivos, 1393/1393 tests pasados tras el cambio de `zod`.
- Backend: Jest sin base de datos disponible en el entorno de la revalidación (sin `DATABASE_URL` ni Postgres): 90 suites fallan por `PrismaClientInitializationError`. El resultado completo queda pendiente de una corrida con Postgres.

## CI

`snyk-security.yml` ahora ejecuta `snyk test --severity-threshold=critical` sobre `backend` y `frontend` sin `|| true`: el pipeline falla si aparece una vulnerabilidad crítica. `snyk code test` (ahora también sobre `frontend` y `backend-ia`) y `snyk monitor` siguen siendo informativos.

## Pendientes

- Verificar HTTPS obligatorio (redirección y HSTS) contra el entorno desplegado.
- `prisma/seed.ts`: no permitir la contraseña de admin por defecto fuera de desarrollo.
- `react-router-dom` / `react-router` 6.30.6 (open redirect, alta; reflexión insegura, media): **decisión del equipo**, pendiente. Opciones: upgrade mayor o riesgo aceptado en un ADR. No resuelto en #321.
- Upgrades mayores pendientes: `tailwindcss` 4, `jest` (20 moderadas de testing), `pytest` 9.x.
- `leaflet@1.9.4` (XSS, media): sin fix disponible.
