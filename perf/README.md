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
- El seed no genera notificaciones: `GET /api/notifications` devuelve lista vacía en ambos volúmenes (mide el costo de la consulta, no el tamaño de la respuesta).
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

## Variables de k6 (`-e NOMBRE=valor`)

| Variable | Default | Uso |
|---|---|---|
| `BASE_URL` | `http://localhost:3001` | URL del backend |
| `THINK_MIN` / `THINK_MAX` | 3 / 8 (smoke: 0,2 / 0,5) | think time en segundos |
| `R2_PUBLIC_URL` | `https://pub-e2e.r2.dev` | origen de las imágenes |
| `PERF_SCALE` | 1 | factor de duración de las etapas de `load.js` y `volume.js` |
| `VOLUME_LABEL` / `VOLUME_RATE` | 1x / 3 | etiqueta de la corrida (1x, 10x) y tasa de `volume.js` (it/s) |

## Resultados

En `perf/results/` (ignorado por git): `<nombre>.summary.json`, `<nombre>.slo.md` (tabla SLO-1 a SLO-5, Apdex, latencias p50/p90/p95/p99 y checks por paso) y `<nombre>.html` (dashboard de k6).

## Estructura

- `lib/`: configuración, login, usuarios (`SharedArray`), think time, métricas (`matching_duration`, Apdex), flujos y `handleSummary`.
- `seed/seed.mjs`: datos. `scripts/start-env.mjs`: entorno.
- Tags `name`: feed, detail, create, matches, mine, flyer, login, me.
