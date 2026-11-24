# Tests de carga (k6) — issue #40

Scripts de performance de Patitas. Todos se ejecutan desde la raíz del repo.

## Requisitos

- k6, Node 24, Docker (Postgres del `docker-compose.yml`, puerto 5433).
- Dependencias instaladas en `backend/` y `frontend/` (el seed reutiliza `bcryptjs` y `pg`).

## 1. Base de performance

```bash
docker compose up -d postgres
docker exec patitas-postgres psql -U patitas -d postgres -c "CREATE DATABASE patitas_perf"
cd backend && DATABASE_URL=postgresql://patitas:patitas@localhost:5433/patitas_perf npx prisma migrate deploy
```

Nunca se siembra contra otra base: el seed aborta si el nombre no contiene `perf`.

## 2. Seed

```bash
node perf/seed/seed.mjs                              # humo: 20 usuarios, 200 reportes
node perf/seed/seed.mjs --users=2000 --reports=1000  # baseline 1x
node perf/seed/seed.mjs --users=2000 --reports=10000 # volumen 10x (escenario T6)
```

- El volumen es una decisión del equipo, documentada como supuesto: baseline 1x = 1000 reportes y 2000 usuarios; 10x = 10000 reportes.
- Una corrida previa a 10x saturó el backend a 100 VUs (`GET /api/reports` sin paginar); sus resultados se conservan como `load.v10x.*`.

- Determinístico (`--seed=42` por defecto), idempotente (borra antes las filas `perf-user-*`).
- Usuarios verificados `perf-user-N@example.com`, contraseña `Patitas123`.
- Reportes `published`, repartidos en 6 ciudades de Argentina, imágenes bajo `https://pub-e2e.r2.dev/pets/`.
- Coincidencias sintéticas (`report_matches`) en el 10 % de los reportes. No se generan embeddings.
- Genera `perf/data/users.json` y `perf/data/report-ids.json` (ignorados por git).
- Variables: `PERF_DATABASE_URL`, `PERF_USERS`, `PERF_REPORTS`, `PERF_SEED`, `PERF_R2_PUBLIC_URL`.

## 3. Entorno (backend + stub de IA)

```bash
node perf/scripts/start-env.mjs
```

Levanta el stub de IA (`frontend/e2e/support/ai-stub-server.ts`, puerto 8765) y el backend compilado
(`node dist/index.js`; `PERF_BACKEND=dist` es el default y corre `npm run build` si `dist` falta o está desactualizado).
`PERF_BACKEND=ts-node` ejecuta con ts-node, que distorsiona los resultados (compilación y overhead en runtime): no usarlo para medir. El backend corre con
`NODE_ENV=test` (los rate limiters solo se saltean así; sin eso se mediría 429), `DATABASE_URL` de la base perf,
`R2_PUBLIC_URL=https://pub-e2e.r2.dev` y `AI_SERVICE_URL` apuntando al stub. Ctrl+C detiene ambos.

El stub responde 409 al embedding: los reportes creados quedan en `pending`, así que `matching_duration`
(SLO-2) queda "no medido". Requiere el Backend IA real.

## 4. Smoke

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/smoke.html k6 run perf/smoke.js
```

2 VUs, 1 min, todos los flujos salvo flyer (requiere R2) y chat (Socket.IO). Pasa con 0 checks fallidos y `http_req_failed` = 0.
El polling tras crear un reporte está acotado a 3 intentos.

## 5. Carga (T2)

```bash
node perf/scripts/sample-resources.mjs --out=perf/results/load.resources.csv --duration=500 &   # opcional, ver abajo
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/load.html k6 run -e PERF_SCALE=0.25 perf/load.js
```

- Modelo cerrado `ramping-vus`: 0→100 (2 min), meseta 5 min; →200 (2 min), meseta 10 min; →500 (3 min), meseta 5 min; →0 (2 min). Total 29 min con `PERF_SCALE=1` (default).
- `PERF_SCALE` multiplica todas las duraciones. Con `PERF_SCALE=0.25` (corrida reducida): 30 s → 100 VUs, meseta 75 s, 30 s → 200, meseta 150 s, 45 s → 500, meseta 75 s, 30 s → 0 (435 s en total).
- Mezcla efectiva (flyer 8 % y chat 7 % omitidos: flyer requiere R2 y chat es Socket.IO; los pesos se re-normalizan sobre el 85 % restante): visitante feed+detalle ×2-3 55/85 = 64,7 %, login+mine+matches 15/85 = 17,6 %, login+crear reporte (+3 polls) 10/85 = 11,8 %, login+me 5/85 = 5,9 %.
- Think time 3-8 s (`THINK_MIN` / `THINK_MAX`). Un usuario distinto por VU (hace falta `--users` ≥ VUs máximos; 500 VUs → seed con 2000 usuarios).
- Cada request lleva el tag `step` (`100`, `200`, `500` o `ramp`, según el tiempo transcurrido). Los thresholds de SLO-1/3/4 se aplican solo a `step:200`; SLO-5 (Apdex) se evalúa en el resumen sobre el mismo paso. 100 y 500 VUs son informativos.
- `matching_duration` (SLO-2) queda "no medido" con el stub de IA (los reportes no salen de `pending`).
- Cada iteración de login cuesta un bcrypt (CPU-bound): ~45 % de las iteraciones lo hacen, así que el login compite por CPU con el resto de la API.
- Muestreo de recursos: `perf/scripts/sample-resources.mjs --out=<csv> [--interval=5] [--duration=SEG]` escribe CPU del backend (% de un núcleo), memoria, CPU total del sistema (Windows) y conexiones de Postgres (`pg_stat_activity`); lee el PID de `perf/results/backend.pid` (lo escribe `start-env.mjs`). Reutilizable por otros escenarios.

## 6. Punto de quiebre B (T5)

```bash
node perf/scripts/sample-resources.mjs --out=perf/results/breakpoint.resources.csv --interval=3 --duration=420 &
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/breakpoint.html k6 run -e PERF_SCALE=0.375 -e BP_START_RATE=2 -e BP_RATE_STEP=0.5 -e BP_STEPS=8 perf/breakpoint.js
```

- Modelo abierto `ramping-arrival-rate`: sube la tasa de arribo (it/s) en escalones de `120 s × PERF_SCALE` (+1 s de rampa) hasta fallar SLO-1 o SLO-3. `BP_STEP_S` fija la duración del escalón en segundos.
- Inicio y paso configurables: `BP_START_RATE` / `BP_RATE_STEP` / `BP_STEPS` (default 2 / 2 / 10). El issue propone 10 it/s con +10; en este entorno (1 backend Node, bcryptjs en JS puro) el primer escalón de 10 it/s ya está por encima de la capacidad medida, por eso el default parte bajo. k6 exige tasas enteras: internamente se usa `timeUnit: 10s`, lo que admite pasos de 0,1 it/s.
- Mezcla `BP_VISITOR_WEIGHT` (default 80): 80 % visitante (feed + 2-3 detalles) y 20 % creación (login + crear, sin polling). Think time 0,2-0,5 s (`THINK_MIN`/`THINK_MAX`): en modelo abierto solo ocupa VUs, no define la carga.
- VUs: `BP_PRE_VUS` 100 / `BP_MAX_VUS` 500. Si k6 no consigue VUs, descarta iteraciones y lo informa en `dropped_iterations` (el resumen lo reporta; no admite tag de escalón, por eso se cuenta aparte `bp_iterations_started{step}`).
- Cada request lleva `step=s<N>`. Thresholds globales de SLO-1 (por endpoint, sin login) y SLO-3 con `abortOnFail` y `delayAbortEval: 30s`; al ser globales y acumulados, el corte llega tarde o no llega. El veredicto por escalón sale de la tabla de `handleSummary` (`breakpoint.slo.md`).
- Capacidad = último escalón consecutivo desde el inicio que cumple SLO-1 y SLO-3. Con ~45 creaciones por escalón el p95 de `create` es ruidoso: un escalón aislado puede cumplir después de uno que falló.

## Variables de k6 (`-e NOMBRE=valor`)

| Variable | Default | Uso |
|---|---|---|
| `BASE_URL` | `http://localhost:3001` | URL del backend |
| `THINK_MIN` / `THINK_MAX` | 3 / 8 (smoke: 0,2 / 0,5) | think time en segundos |
| `R2_PUBLIC_URL` | `https://pub-e2e.r2.dev` | origen de las imágenes |
| `PERF_SCALE` | 1 | factor de duración de las etapas de `load.js` |

## Resultados

En `perf/results/` (ignorado por git): `<nombre>.summary.json`, `<nombre>.slo.md` (tabla SLO-1 a SLO-5, Apdex, latencias p50/p90/p95/p99 y checks por paso) y `<nombre>.html` (dashboard de k6).

## Estructura

- `lib/`: configuración, login, usuarios (`SharedArray`), think time, métricas (`matching_duration`, Apdex), flujos y `handleSummary`.
- `seed/seed.mjs`: datos. `scripts/start-env.mjs`: entorno.
- Tags `name`: feed, detail, create, matches, mine, flyer, login, me.
