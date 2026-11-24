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
node perf/seed/seed.mjs --users=2000 --reports=10000 # volumen propuesto en el issue
```

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

Levanta el stub de IA (`frontend/e2e/support/ai-stub-server.ts`, puerto 8765) y el backend con
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

## Variables de k6 (`-e NOMBRE=valor`)

| Variable | Default | Uso |
|---|---|---|
| `BASE_URL` | `http://localhost:3001` | URL del backend |
| `THINK_MIN` / `THINK_MAX` | 3 / 8 (smoke: 0,2 / 0,5) | think time en segundos |
| `R2_PUBLIC_URL` | `https://pub-e2e.r2.dev` | origen de las imágenes |

## Resultados

En `perf/results/` (ignorado por git): `<nombre>.summary.json`, `<nombre>.slo.md` (tabla SLO-1 a SLO-5, Apdex, latencias p50/p90/p95/p99 y checks por paso) y `<nombre>.html` (dashboard de k6).

## Estructura

- `lib/`: configuración, login, usuarios (`SharedArray`), think time, métricas (`matching_duration`, Apdex), flujos y `handleSummary`.
- `seed/seed.mjs`: datos. `scripts/start-env.mjs`: entorno.
- Tags `name`: feed, detail, create, matches, mine, flyer, login, me.
