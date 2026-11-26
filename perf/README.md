# Tests de carga (k6) — issue #40

Scripts de performance de Patitas. Todos se ejecutan desde la raíz del repo.

## Requisitos

- k6, Node 24, Docker (Postgres del `docker-compose.yml`, puerto 5433).
- Dependencias instaladas en `backend/` y `frontend/` (el seed reutiliza `bcryptjs` y `pg`). Si `backend/node_modules` es anterior a la cola Redis (ADR-0034), el backend no compila por falta de `bullmq` e `ioredis`: correr `npm install` en `backend/` (el CI usa `npm ci --legacy-peer-deps`).

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

## 7. Estrés S (T4)

```bash
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/stress.html k6 run -e PERF_SCALE=0.3333 perf/stress.js
```

- Modelo abierto: base (4,5 it/s, capacidad medida en T5) → x1,5 → x2 → x3 → recuperación a la base. Mezcla 80/20 visitante/creación.
- La recuperación se divide en `recovery_drain` (primeros `STRESS_DRAIN_S` = 30 s, vaciado de la cola acumulada) y `recovery_steady` (el resto). El criterio de SLO-1 recuperado se evalúa solo sobre `recovery_steady`: agregado, la recuperación quedaba dominada por el drenaje.
- Salidas: `stress.summary.json`, `stress.levels.json` (tramos con timestamps), `stress.slo.md`.

## 8. Picos P (T3)

```bash
node perf/scripts/sample-resources.mjs --out=perf/results/spike.resources.csv --interval=3 --duration=190 &
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/spike.html k6 run -e PERF_SCALE=0.3333 perf/spike.js
```

- Modelo abierto `ramping-arrival-rate`: base (`SPIKE_BASE_RATE`, default 2 it/s, 60 s × `PERF_SCALE`) → x10 (`SPIKE_FACTOR`) en 10 s → pico 120 s × `PERF_SCALE` → base en 10 s → recuperación 180 s × `PERF_SCALE`. Las rampas de 10 s no se escalan (`SPIKE_RAMP_S`). Con `PERF_SCALE=0,3333`: 20 s / 10 s / 40 s / 10 s / 60 s (140 s).
- Flujo solo visitante (feed + detalle x2-3, sin login, sin bcrypt). El flyer se omite: requiere R2.
- Base 2 it/s en lugar de los 10 it/s del issue: la capacidad medida en T5 es 4,5 it/s con mezcla 80/20 (con login/bcrypt), y 10 it/s base daría un pico de 100 it/s. La capacidad solo-visitante no está medida; `SPIKE_BASE_RATE` permite subirla. Corrida con la base del issue (`-e SPIKE_BASE_RATE=10`, pico 100 it/s): el pico supera la capacidad solo-visitante (31,3 it/s medidos, 3223 `dropped_iterations` con 500 VUs); la corrida con base 2 se conserva como `spike.base2.*`.
- Tags `step`: `base`, `spike` (incluye ambas rampas), `recovery_drain` (primeros 30 s, `SPIKE_DRAIN_S`), `recovery_steady`. Criterios: error < 5 % en `spike`; SLO-1 (p95 < 500 ms por endpoint) en `recovery_steady`.
- Tiempo hasta recuperar: cada request lleva además el tag `win` (ventana de 5 s desde el arranque). `handleSummary` toma el p95 por ventana de los submétricos `{name,win}` y reporta la primera ventana posterior al fin del pico con p95 < 500 ms y la primera a partir de la cual todas cumplen. La serie completa queda en `spike.windows.json` y en `spike.slo.md`; los timestamps, en `spike.levels.json`.

## 9. Volumen V (T6)

```bash
# 1x
node perf/seed/seed.mjs --users=2000 --reports=1000
node perf/scripts/start-env.mjs                      # en otra terminal
node perf/scripts/sample-resources.mjs --out=perf/results/volume.1x.resources.csv --interval=3 --duration=400 &
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/volume.1x.html k6 run -e VOLUME_LABEL=1x perf/volume.js
# 10x (detener y reiniciar start-env.mjs tras el seed)
node perf/seed/seed.mjs --users=2000 --reports=10000
node perf/scripts/sample-resources.mjs --out=perf/results/volume.10x.resources.csv --interval=3 --duration=400 &
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/volume.10x.html k6 run -e VOLUME_LABEL=10x perf/volume.js
# comparación
node perf/scripts/compare-volume.mjs
```

- Mismo nivel de carga con la base a 1x y 10x. Volúmenes: 1x = 1000 reportes / 2000 usuarios; 10x = 10000 reportes / 2000 usuarios. Es una decisión del equipo, documentada como supuesto.
- Modelo abierto `constant-arrival-rate` a `VOLUME_RATE` (default 3 it/s). Se eligió ~2/3 de la capacidad medida en T5 (4,5 it/s con mezcla 80/20): un nivel por encima saturaría ambos volúmenes y la comparación mediría la saturación, no el efecto del volumen. Las iteraciones de usuario no incluyen creación, por lo que el costo por iteración es menor que en T5.
- Duración: warm-up `60 s × PERF_SCALE` (tag `step=warmup`, no se evalúa) + medición `300 s × PERF_SCALE` (`step=measure`). `VOLUME_WARMUP_S` / `VOLUME_MEASURE_S` fijan los segundos. Los 400 s del sampler cubren `PERF_SCALE=1` (360 s + cierre).
- Mezcla `VOLUME_VISITOR_WEIGHT` (default 70): 70 % visitante (feed + detalle ×2-3) y 30 % usuario (login + `GET /api/reports/mine` + `GET /api/notifications`, tag `name=notifications`). Think time 0,2-0,5 s. VUs: `VOLUME_PRE_VUS` 50 / `VOLUME_MAX_VUS` 300.
- Tamaño de respuesta: `Trend` `feed_body_bytes`, `detail_body_bytes`, `mine_body_bytes`, `notifications_body_bytes` (`res.body.length`, solo fase medida).
- El seed no genera notificaciones: `GET /api/notifications` devuelve lista vacía en ambos volúmenes (mide el costo de la consulta, no el tamaño de la respuesta). Desde #338 la respuesta es paginada (`{ items, nextCursor }`, 20 por defecto).
- Criterio: SLO-1 (p95 < 500 ms por endpoint, sin login) cumplido a 10x, y error < 1 % (SLO-3). Los thresholds de k6 se aplican solo a `step:measure`.
- Salidas por corrida: `volume.<label>.summary.json`, `volume.<label>.slo.md`, `volume.<label>.html`. `compare-volume.mjs` genera `volume.compare.md` (tabla 1x vs 10x: p95, error %, bytes de respuesta, SLO-1) y `volume.compare.json` (series por endpoint para gráficos de barras: `p95Ms`, `errorPct`, `bodyBytes`).
- Para comparar solo cambia el volumen de la base: backend, stub y parámetros de k6 deben ser idénticos entre ambas corridas.

## 10. Resistencia E (T7)

```bash
node perf/seed/seed.mjs --users=2000 --reports=1000
node perf/scripts/start-env.mjs > perf/results/soak.env.log 2>&1 &     # el log permite medir su tamaño
node perf/scripts/sample-resources.mjs --out=perf/results/soak.resources.csv --interval=10 --duration=2400 --db-size --log-file=perf/results/soak.env.log &
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/soak.html k6 run -e SOAK_MINUTES=35 -e SOAK_RAMP_MIN=2 perf/soak.js > perf/results/soak.out.txt 2>&1
node perf/scripts/analyze-soak.mjs
```

- **El issue pide 4 h** (`SOAK_MINUTES=240`, rampas de 5 min, que son los defaults). La corrida del equipo es **reducida a 35 min**: rampa de subida 2 min, fase estable 31 min, rampa de bajada 2 min. Una fuga lenta puede no manifestarse en 31 min: el resultado es una cota inferior, no equivale a la prueba de 4 h.
- Modelo abierto `ramping-arrival-rate` a `SOAK_RATE` (default 3,15 it/s = 70 % de los 4,5 it/s de T5), con `timeUnit: 100s` para admitir fracciones. VUs `SOAK_PRE_VUS` 150 / `SOAK_MAX_VUS` 500.
- Mezcla de `load.js` sin flyer ni chat, pesos re-normalizados: visitante 55/85 (64,7 %), login+mine+matches 17,6 %, login+crear (+3 polls) 11,8 %, login+me 5,9 %. Think time 3-8 s. Es más pesada que la 80/20 de T5 (~45 % de iteraciones con login/bcrypt frente a 20 %): 70 % de la tasa de T5 no equivale a 70 % de la capacidad para esta mezcla.
- Cada request lleva el tag `third`: `ramp` (rampas), `t1`/`t2`/`t3` (tercios de igual duración de la fase estable, por tiempo transcurrido desde `exec.scenario.startTime`). El criterio del issue "última hora <= 110 % de la primera" se evalúa como **p95 del tercio t3 <= 110 % del de t1**, por endpoint (sin login) y el peor; con 4 h equivaldría a tercios de 80 min, no a horas. Es un sustituto por la duración reducida.
- Thresholds de SLO-1, SLO-3 y SLO-4 sobre toda la corrida (incluidas rampas), sin `abortOnFail`. SLO-2 no se mide (stub de IA).
- Recursos: el sampler admite columnas opcionales `--db-size` (`db_size_mb`, `pg_database_size`) y `--log-file=<ruta>` (`log_size_kb`); sin esos flags el CSV no cambia. `analyze-soak.mjs` alinea el CSV con k6 mediante `SOAK_START_MS` (impreso en `setup()`), toma la fase estable, calcula la pendiente de mínimos cuadrados (por minuto) y las medias por tercio, y escribe `soak.analysis.md/json`. Criterio de "crecimiento sostenido" (RSS y conexiones pg): |t| > 3 de la pendiente y crecimiento proyectado sobre la fase estable > 10 % de la media de t1 (mismo 10 % que el criterio de p95) y > piso de ruido absoluto (10 MB, 2 conexiones). CPU, tamaño de la base y del log son informativos.
- El soak crea reportes de forma continua (~11,8 % de las iteraciones): la base perf crece durante la corrida y se debe volver a sembrar después (el seed borra los reportes de los usuarios `perf-user-*`).
- Salidas: `soak.summary.json`, `soak.meta.json`, `soak.slo.md`, `soak.html`, `soak.resources.csv`, `soak.analysis.md/json`.

## 11. Escalabilidad C (T8)

```bash
node perf/scripts/run-scalability.mjs --n=1,2,4 --plan=1:18:2:8,2:18:3:8,4:24:6:8   # plan = N:inicio:paso:escalones (it/s)
node perf/scripts/compare-scalability.mjs                                           # scalability.compare.{md,json}
```

- **"N CPU" = N instancias** del backend (`node dist/index.js`, puertos 3001..3004), cada una fija a **un hilo lógico propio** (afinidad de proceso; hilos 1, 3, 5, 7 para evitar el 0), detrás de un balanceador round-robin en el puerto 8080. Node es de un solo hilo: darle más núcleos a un proceso no lo escala. k6 se fija a los hilos 0, 2, 4 y el proxy al 6. Con la afinidad también quedan en ese hilo el motor de consultas de Prisma, el GC y el threadpool de libuv de cada instancia.
- Solo flujo visitante (feed + 2-3 detalles, sin login: no domina bcrypt). Sin chat: Socket.IO y los timers de `backend/src/index.ts` (reconciliación de `pending`, vencimiento de sanciones, inactividad) no están listos para multi-instancia (issue #347); con N instancias esos timers corren N veces.
- `perf/scalability.js`: modelo abierto `ramping-arrival-rate` (misma lógica de escalones que `breakpoint.js`, que no es importable sin efectos). Variables `SC_START_RATE`, `SC_RATE_STEP`, `SC_STEPS`, `SC_STEP_S` (45 s), `SC_MAX_VUS` (1500), `SC_LABEL`. Capacidad = último escalón consecutivo que cumple SLO-1 (p95 < 500 ms por endpoint), error < 1 % y entrega >= 95 % de la tasa objetivo (criterio agregado: sin él, las iteraciones descartadas inflan la capacidad). Hay un calentamiento de 40 requests en `setup()`.
- `run-scalability.mjs` hace por cada N: seed 1x + `VACUUM ANALYZE` + 10 s, levanta instancias y balanceador, corre k6 (`scalability.<N>cpu.{html,summary.json,steps.json,slo.md,out.txt,resources.csv,meta.json}`) y lo desmonta todo. `--balancer=nginx` usa `perf/scalability/nginx.conf.template` (contenedor `nginx:alpine`); `--direct` apunta k6 a la instancia 1 sin balanceador (diagnóstico).
- **Balanceador: proxy de Node (`perf/scalability/proxy.mjs`), no nginx.** Con nginx en Docker Desktop (Windows) el camino k6 -> puerto publicado -> contenedor -> `host.docker.internal` -> backend pasa dos veces por `com.docker.backend` (79 % de un núcleo medido a 15 it/s) y con 2 instancias al 35 % de CPU el p95 del feed era 965 ms a 12 it/s; con el proxy de Node, a la misma tasa, 63 ms. Las corridas con nginx se descartaron.
- **Pool de Prisma:** `connection_limit=10` por instancia en la `DATABASE_URL` (igual en todas las configuraciones: el pool total crece con N; máximo 40 de las 100 de `max_connections`). Es un parámetro válido de la URL para Prisma 5/6 (la documentación consultada lo confirma para Prisma 6, donde el default es 10 con adaptadores; para el motor de consultas de Prisma 5.22 de este repo no se pudo releer la fórmula en la documentación). Verificación empírica: sin `connection_limit`, 120 requests concurrentes abrieron **9 conexiones** = `num_physical_cpus * 2 + 1` con 4 núcleos físicos; con el parámetro el máximo observado fue 10 por instancia (+1 del sampler). La variación del pool no se barrió: queda fijo en 10.
- Sampler (`sample-resources.mjs`, compatible hacia atrás): `--pids=1,2,3` agrega columnas `inst<k>_cpu_pct/rss_mb` (y `backend_*` pasa a ser la suma); `--aux-pids=` agrega `aux<k>_*` (k6, proxy).
- **Limitación de la máquina:** 4 núcleos físicos / 8 lógicos (hyperthreading). k6, proxy, Postgres (contenedor en la VM de WSL2), Docker Desktop y el resto del sistema comparten los mismos núcleos que las instancias; el hilo lógico 2k+1 de cada instancia es hermano del 2k, donde corre k6. Con 4 instancias se ocupan los 4 núcleos físicos. La CPU del sistema en reposo (sin ninguna corrida) midió 20-46 % por aplicaciones ajenas (Discord, etc.).
- **Resultados:** `perf/results/scalability.compare.{md,json}` (el json trae capacidad, ratios, CPU por instancia y curvas por escalón para gráficos). Las corridas no son reproducibles entre sí: la capacidad de 1 instancia dio 18-20 it/s (cumple hasta 18 o 20), < 16, >= 24 (sin fallo en la grilla) y < 18 en corridas distintas con la misma configuración. Las repeticiones se conservan en `perf/results/rep1/` y `perf/results/rep2-n1-censurado/`. Con CPU del sistema 80 % y la instancia al 64 % el escalón colapsa; con el sistema al 43 % la misma instancia llega a 83 % y sostiene 24 it/s. Hasta repetir en una máquina sin carga ajena, el criterio x1,6 no se puede dar por cumplido ni por incumplido.

## 12. Lighthouse CI (T9)

```bash
node perf/scripts/start-env.mjs                                   # backend + stub (otra terminal)
cd frontend && npm run build && npx vite preview --port 4173 --strictPort   # otra terminal
CHROME_PATH=<ruta a chrome.exe> node perf/scripts/run-lighthouse.mjs        # mobile y desktop
node perf/scripts/summarize-lighthouse.mjs
```

- Rutas: `/reports`, `/login` y `/reports/<id>` (el primer id de `perf/data/report-ids.json`, agregado por `run-lighthouse.mjs`). Las tres son públicas: no hace falta sesión.
- Configs: `perf/lighthouserc.mobile.json` (default de Lighthouse) y `perf/lighthouserc.desktop.json` (`settings.preset: "desktop"`). 3 corridas por URL; `upload.target: "filesystem"` en `perf/results/lighthouse/<mobile|desktop>`.
- Umbrales propuestos (a calibrar con el baseline): `categories:performance` >= 0,80 y `categories:accessibility` >= 0,90, sobre la mediana. Las métricas (FCP, LCP, TBT, CLS, TTI) solo se recolectan, sin umbral.
- `run-lighthouse.mjs` ejecuta `collect`, `assert` y `upload` por separado: si `assert` falla, igual se generan los artefactos y el proceso sale con código 2.
- Se usa `npx @lhci/cli@0.15.1` (versión fija; no es dependencia del repo). Necesita Chrome/Chromium: `CHROME_PATH` o el de Playwright (`%LOCALAPPDATA%/ms-playwright/chromium-*/chrome-win64/chrome.exe`).
- El frontend llega a la API por el proxy de `vite preview` (`vite.config.ts`: `/api` y `/socket.io` hacia `localhost:3001`), no por `VITE_API_URL`; el backend debe estar en el puerto 3001.
- Salidas: `*.report.json`, `*.report.html` y `manifest.json` por form factor, `summary.md` y `summary.json` (mediana por ruta y form factor: performance, accesibilidad, FCP, LCP, TBT, CLS, TTI, peso total, requests JS, auditorías de accesibilidad fallidas).

## 13. Observabilidad liviana (T11)

Prometheus + Grafana en Docker, solo para uso local. No hay cAdvisor, node-exporter ni postgres_exporter: Docker Desktop (`com.docker.backend`) ya consumió ~79 % de un núcleo en la prueba de escalabilidad y distorsiona la medición, así que se mantienen pocos contenedores y con límites (`mem_limit`, `cpus`). CPU/memoria del backend y conexiones de Postgres salen del sampler del repo.

```bash
docker compose -f perf/observability/docker-compose.yml up -d     # Prometheus :9090, Grafana :3000
node perf/scripts/start-env.mjs                                    # otra terminal
node perf/scripts/sample-resources.mjs --out=perf/results/load.resources.csv --duration=500 --metrics-port=9101 &
export K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write K6_PROMETHEUS_RW_TREND_STATS="p(50),p(90),p(95),p(99)"
k6 run -o experimental-prometheus-rw --tag testid=load-1x -e PERF_SCALE=0.25 perf/load.js
# punto de quiebre: sampler con --interval=3 --duration=420, y --tag testid=breakpoint-1x con los parámetros de la sección 6
docker compose -f perf/observability/docker-compose.yml down       # sin -v: se descartan los datos de la corrida
```

- Ver en http://localhost:3000 (acceso anónimo de solo lectura): `Carga y recursos` (p95, RPS, VUs y error de k6 + CPU/RSS del backend y conexiones de Postgres en el mismo eje de tiempo), `Recursos del backend` y `k6 Prometheus` (dashboard oficial 19665 de Grafana k6, revisión 3, vendorizado).
- Prometheus (`:9090`), Grafana (`:3000`) y el `/metrics` del sampler (`:9101`) escuchan solo en `127.0.0.1`; no son accesibles desde la red local.
- Las métricas de k6 llevan el tag `testid`; el dashboard lo ofrece como filtro. Los percentiles llegan como gauges (`k6_http_req_duration_p95`) por `K6_PROMETHEUS_RW_TREND_STATS`.
- `--metrics-port=<n>` del sampler sirve `/metrics` (`perf_backend_cpu_percent_of_core`, `perf_backend_rss_bytes`, `perf_system_cpu_percent`, `perf_pg_connections`, `perf_pg_connections_active`); sin el flag no cambia nada. Prometheus lo scrapea cada 5 s por `host.docker.internal:9101`.
- `node perf/observability/capture.mjs --from=<ms> --to=<ms> --out=<png>` captura el dashboard combinado con Chromium de Playwright.
- Limitación: el overhead de Docker Desktop se midió durante las corridas (ver el informe) y los contenedores comparten núcleos con k6 y el backend. Las corridas con observabilidad no son comparables 1:1 con las de baseline. Solo local.

## 14. Matching SLO-2 con el Backend IA real

> Receta y resultado validados antes de integrar los cambios de `main` que mueven el pipeline de IA a una cola Redis (ADR-0034) y quitan el acceso a la base del Backend IA (ADR-0029). Con esa arquitectura hacen falta Redis y el worker del backend, y el Backend IA ya no usa `DATABASE_URL`: la receta de abajo no se revalidó.

```bash
python -m venv perf/.venv-ia                                  # ignorado por git (su propio .gitignore)
perf/.venv-ia/Scripts/python -m pip install --index-url https://download.pytorch.org/whl/cpu torch==2.13.0 torchvision==0.28.0
perf/.venv-ia/Scripts/python -m pip install -r backend-ia/requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
node perf/seed/seed.mjs --users=2000 --reports=1000
# imágenes: servidor estático con /pets/dog.jpg (copia de backend-ia/tests/fixtures/dog.jpg), puerto 8780
cd <dir con pets/dog.jpg> && python -m http.server 8780 --bind 127.0.0.1
# Backend IA (desde un directorio vacío: YOLO descarga yolov8n.pt en el cwd; el primer arranque baja los pesos de DINOv2)
DATABASE_URL=postgresql+asyncpg://patitas:patitas@localhost:5433/patitas_perf INTERNAL_API_KEY=perf-internal-key \
  perf/.venv-ia/Scripts/python -m uvicorn app.main:app --app-dir backend-ia --port 8000
# backend (en vez de start-env.mjs, que levanta el stub); escribir su PID en perf/results/backend.pid
cd backend && NODE_ENV=test DATABASE_URL=postgresql://patitas:patitas@localhost:5433/patitas_perf JWT_SECRET=perf-jwt-secret-not-for-production \
  R2_PUBLIC_URL=http://localhost:8780/pets INTERNAL_API_KEY=perf-internal-key AI_SERVICE_URL=http://localhost:8000 node dist/index.js
node perf/scripts/sample-resources.mjs --out=perf/results/matching.resources.csv --interval=3 --duration=345 --aux-pids=<PID del Backend IA> &
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/matching.html k6 run perf/matching.js
```

- Flujo: login, `POST /api/reports` con una imagen del servidor estático y polling de `GET /api/reports/:id` cada 0,5 s hasta que el estado deje de ser `pending` (máximo `MATCH_TIMEOUT` = 60 s). Después consulta `GET /api/reports/:id/matches` (`matches_after_publish`).
- **Supuesto (decisión pendiente del equipo):** "matching terminado" = el reporte sale de `pending` (`published` o `rejected`). No exige que existan filas en `report_matches`.
- Métricas (ms), con tag `outcome` (`published`, `rejected`, `timeout`): `matching_duration` (desde la respuesta del POST hasta el primer GET no `pending`) y `matching_duration_total` (desde el inicio del POST). La resolución es de ±0,5 s por el polling. El threshold de SLO-2 (p95 < 5000 ms) se aplica solo a `outcome:published`.
- Modelo abierto `constant-arrival-rate` a `MATCH_RATE` (default 0,5 it/s, `MATCH_DURATION_S` = 300): baja a propósito para no encolar artificialmente la inferencia en CPU de un único proceso. Otras variables: `MATCH_POLL_S`, `MATCH_PRE_VUS`, `MATCH_MAX_VUS`, `MATCH_IMAGES` (nombres separados por coma), `MATCH_IMAGE_BASE`.
- El `POST /api/reports` es síncrono con el Backend IA (`/images/analyze`, YOLO) y recién después dispara el embedding; por eso `matching_duration_total` incluye ese tiempo y `matching_duration` no.
- Salidas: `matching.summary.json`, `matching.slo.md`, `matching.html`, `matching.resources.csv`.

Limitaciones:

- Inferencia en CPU (torch CPU) en una máquina de desarrollo compartida (k6, backend, Postgres en Docker y el Backend IA comparten núcleos); no representa un servidor de producción.
- Solo existe una foto real de mascota en el repo (`backend-ia/tests/fixtures/dog.jpg`): todos los reportes comparten la imagen (la URL lleva `?v=` distinto). `landscape.jpg` no sirve: el backend responde 422 en la creación (sin animal) y nunca llega a `rejected`, por lo que el outcome `rejected` no se ejercita.
- Los reportes del seed no tienen embeddings: los candidatos de matching son solo los creados durante la corrida (misma imagen, similitud máxima). Con embeddings en los 1000 reportes la búsqueda pgvector sería más costosa.
- Tras la corrida la base queda con reportes y embeddings nuevos: volver a sembrar.
- El sampler con `--aux-pids` sin `--pids` desplaza las columnas: las métricas del proceso auxiliar quedan en las columnas 10 y 11 (sin encabezado) y las columnas `aux1_*` repiten las del backend.

## 15. Polling de notificaciones (#338)

```bash
node perf/seed/seed.mjs --users=2000 --reports=1000
node perf/scripts/start-env.mjs                      # en otra terminal
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=perf/results/notifications-polling.html k6 run perf/notifications-polling.js
```

- Escenario "N usuarios con polling de notificaciones": cada VU inicia sesión una vez y consulta `GET /api/notifications/unread-count` (tag `name=unread_count`) cada `POLLING_INTERVAL_S` (default 30 s, el intervalo del frontend). La primera consulta de cada VU se desfasa al azar dentro del intervalo.
- Modelo cerrado `ramping-vus`: 0→`POLLING_VUS` (default 200, la concurrencia de SLO-1) en 60 s, meseta 300 s, bajada 30 s; `PERF_SCALE` multiplica las duraciones.
- Umbral: SLO-1 (p95 < 500 ms) y SLO-3 (error < 1 %) sobre `name=unread_count`; checks > 99 %. El login queda afuera.
- Salidas: `notifications-polling.summary.json`, `notifications-polling.slo.md`.

## Variables de k6 (`-e NOMBRE=valor`)

| Variable | Default | Uso |
|---|---|---|
| `BASE_URL` | `http://localhost:3001` | URL del backend |
| `THINK_MIN` / `THINK_MAX` | 3 / 8 (smoke: 0,2 / 0,5) | think time en segundos |
| `R2_PUBLIC_URL` | `https://pub-e2e.r2.dev` | origen de las imágenes |
| `PERF_SCALE` | 1 | factor de duración de las etapas de `load.js` y `volume.js` |
| `VOLUME_LABEL` / `VOLUME_RATE` | 1x / 3 | etiqueta de la corrida (1x, 10x) y tasa de `volume.js` (it/s) |
| `POLLING_VUS` / `POLLING_INTERVAL_S` | 200 / 30 | usuarios y segundos entre consultas de `notifications-polling.js` |

## Resultados

En `perf/results/` (ignorado por git): `<nombre>.summary.json`, `<nombre>.slo.md` (tabla SLO-1 a SLO-5, Apdex, latencias p50/p90/p95/p99 y checks por paso) y `<nombre>.html` (dashboard de k6).

## Estructura

- `lib/`: configuración, login, usuarios (`SharedArray`), think time, métricas (`matching_duration`, Apdex), flujos y `handleSummary`.
- `seed/seed.mjs`: datos. `scripts/start-env.mjs`: entorno.
- Tags `name`: feed, detail, create, matches, mine, flyer, login, me, notifications (`volume.js`), unread_count (`notifications-polling.js`).
