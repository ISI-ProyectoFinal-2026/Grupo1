import exec from 'k6/execution'
import http from 'k6/http'
import { Counter, Gauge, Rate } from 'k6/metrics'
import { BASE_URL, ENDPOINTS, SLO, SUMMARY_TREND_STATS } from './lib/config.js'
import { browseFeed, createReport } from './lib/flows.js'
import { onBeforeRequest } from './lib/http.js'

// estrés S: modelo abierto, sobrecarga escalonada sobre la capacidad de referencia y retorno al 100 %
const SCALE = Number(__ENV.PERF_SCALE ?? 1)
const BASE_RATE = Number(__ENV.STRESS_BASE_RATE ?? 4.5) // it/s, capacidad sostenible medida en T5
const LEVEL_S = Math.max(10, Math.round(Number(__ENV.STRESS_LEVEL_S ?? 180 * SCALE)))
const RECOVERY_S = Math.max(10, Math.round(Number(__ENV.STRESS_RECOVERY_S ?? 300 * SCALE)))
const RAMP_S = Math.max(1, Math.round(Number(__ENV.STRESS_RAMP_S ?? 5)))
const VISITOR_WEIGHT = Number(__ENV.STRESS_VISITOR_WEIGHT ?? 80)
const PRE_VUS = Number(__ENV.STRESS_PRE_VUS ?? 100)
const MAX_VUS = Number(__ENV.STRESS_MAX_VUS ?? 500)
const ERROR_LIMIT = Number(__ENV.STRESS_ERROR_LIMIT ?? 0.05)
const THINK = [Number(__ENV.THINK_MIN ?? 0.2), Number(__ENV.THINK_MAX ?? 0.5)]

// niveles: factor sobre la tasa de referencia
const LEVELS = [
  { tag: 'base', factor: 1, holdS: LEVEL_S, overload: false },
  { tag: 'x1.5', factor: 1.5, holdS: LEVEL_S, overload: true },
  { tag: 'x2', factor: 2, holdS: LEVEL_S, overload: true },
  { tag: 'x3', factor: 3, holdS: LEVEL_S, overload: true },
  { tag: 'recovery', factor: 1, holdS: RECOVERY_S, overload: false },
].map((l) => ({ ...l, rate: BASE_RATE * l.factor, windowS: RAMP_S + l.holdS }))

// inicio (s desde el arranque) de cada nivel; la rampa pertenece al nivel que la sigue
let acc = 0
for (const l of LEVELS) {
  l.startS = acc
  acc += l.windowS
  l.endS = acc
}
const TOTAL_S = acc

const API_ENDPOINTS = ENDPOINTS.filter((e) => e !== 'login')
const USED_ENDPOINTS = ['feed', 'detail', 'login', 'create']

const started = new Counter('stress_iterations_started')
const t0Gauge = new Gauge('stress_t0_ms')
const alive = new Rate('stress_alive')

// submétricos por nivel (thresholds vacíos para que k6 los exponga)
const submetrics = {}
for (const l of LEVELS) {
  for (const name of USED_ENDPOINTS) submetrics[`http_req_duration{name:${name},step:${l.tag}}`] = []
  for (const m of ['http_reqs', 'http_req_failed', 'checks', 'stress_iterations_started']) submetrics[`${m}{step:${l.tag}}`] = []
}

const rateOf = (r) => Math.round(r * 10)

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: rateOf(BASE_RATE),
      timeUnit: '10s', // tasas enteras en it/10 s para admitir fraccionarias
      preAllocatedVUs: PRE_VUS,
      maxVUs: MAX_VUS,
      stages: LEVELS.flatMap((l, i) => [
        { target: rateOf(l.rate), duration: `${i === 0 ? 1 : RAMP_S}s` },
        { target: rateOf(l.rate), duration: `${i === 0 ? l.holdS + RAMP_S - 1 : l.holdS}s` },
      ]),
      gracefulStop: '30s',
      exec: 'stress',
    },
    // verificación de vida del backend al terminar la carga
    health: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      startTime: `${TOTAL_S + 35}s`,
      exec: 'health',
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: { ...submetrics, stress_alive: [], stress_t0_ms: [] },
}

function levelAt(elapsedS) {
  for (const l of LEVELS) if (elapsedS < l.endS) return l
  return LEVELS[LEVELS.length - 1]
}

let currentTag = null
onBeforeRequest(() => {
  const tag = levelAt((Date.now() - exec.scenario.startTime) / 1000).tag
  if (tag !== currentTag) {
    currentTag = tag
    exec.vu.tags.step = tag
  }
})

export function stress() {
  const tag = levelAt((Date.now() - exec.scenario.startTime) / 1000).tag
  started.add(1, { step: tag })
  t0Gauge.add(exec.scenario.startTime)
  if (Math.random() * 100 < VISITOR_WEIGHT) browseFeed(THINK)
  else createReport(THINK, { pollAttempts: 0 })
}

export function health() {
  const res = http.get(`${BASE_URL}/health`, { tags: { name: 'health' }, timeout: '10s' })
  alive.add(res.status === 200)
}

// ---- resumen por nivel ----
const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')

function levelRow(data, l) {
  const t = l.tag
  const m = data.metrics
  const reqs = values(m[`http_reqs{step:${t}}`])?.count ?? 0
  const iters = values(m[`stress_iterations_started{step:${t}}`])?.count ?? 0
  const lat = {}
  for (const name of USED_ENDPOINTS) {
    const v = values(m[`http_req_duration{name:${name},step:${t}}`])
    lat[name] = v && v.max > 0 ? v : undefined
  }
  const apiP95 = API_ENDPOINTS.map((n) => lat[n]?.['p(95)']).filter((x) => x !== undefined)
  const maxP95 = apiP95.length ? Math.max(...apiP95) : undefined
  const failed = values(m[`http_req_failed{step:${t}}`])?.rate
  const checks = values(m[`checks{step:${t}}`])?.rate
  const checksFailed = typeof checks === 'number' ? 1 - checks : undefined
  const errPct = Math.max(failed ?? 0, checksFailed ?? 0)
  const target = l.rate * l.windowS
  return {
    l, reqs, iters, lat, maxP95, failed, checksFailed, errPct,
    itPerS: iters / l.windowS,
    reqPerS: reqs / l.windowS,
    droppedEst: Math.max(0, Math.round(target - iters)),
    slo1: maxP95 !== undefined && maxP95 < SLO.p95Ms,
  }
}

export function handleSummary(data) {
  const rows = LEVELS.map((l) => levelRow(data, l))
  const dropped = values(data.metrics.dropped_iterations)?.count ?? 0
  const t0 = values(data.metrics.stress_t0_ms)?.value
  const aliveRate = values(data.metrics.stress_alive)?.rate

  const overload = rows.filter((r) => r.l.overload)
  const recovery = rows[rows.length - 1]
  const critAlive = aliveRate === 1
  const critErr = overload.every((r) => r.errPct < ERROR_LIMIT)
  const critRecovery = recovery.slo1

  const levelsJson = {
    scenario_start_ms: t0,
    scenario_start_iso: typeof t0 === 'number' ? new Date(t0).toISOString() : null,
    base_rate_its: BASE_RATE,
    levels: LEVELS.map((l) => ({
      step: l.tag,
      factor: l.factor,
      target_it_s: l.rate,
      start_s: l.startS,
      end_s: l.endS,
      start_iso: typeof t0 === 'number' ? new Date(t0 + l.startS * 1000).toISOString() : null,
      end_iso: typeof t0 === 'number' ? new Date(t0 + l.endS * 1000).toISOString() : null,
    })),
  }

  const lines = [
    '# Resumen stress',
    '',
    `Modelo abierto ramping-arrival-rate: referencia 100 % = ${BASE_RATE} it/s; niveles ${LEVELS.map((l) => `${l.tag} (${fmt(l.rate, 2)} it/s, ${l.holdS} s + ${RAMP_S} s de rampa)`).join(', ')}. Mezcla ${VISITOR_WEIGHT}/${100 - VISITOR_WEIGHT} visitante/creación, VUs ${PRE_VUS}..${MAX_VUS}.`,
    `Duración medida: ${fmt(data.state?.testRunDurationMs / 1000, 1)} s. Pico de VUs: ${values(data.metrics.vus_max)?.max ?? 'n/d'}. dropped_iterations total: ${dropped}.`,
    '',
    '## Criterios',
    '',
    '| Criterio | Resultado | Detalle |',
    '|---|---|---|',
    `| El proceso no cae (GET /health tras la carga) | ${critAlive ? 'cumple' : 'NO cumple'} | stress_alive = ${fmt(aliveRate, 2)} |`,
    `| Error < ${ERROR_LIMIT * 100} % en sobrecarga (x1.5, x2, x3) | ${critErr ? 'cumple' : 'NO cumple'} | ${overload.map((r) => `${r.l.tag}: ${fmt(r.errPct * 100, 2)} %`).join('; ')} |`,
    `| SLO-1 recuperado en recovery (p95 < ${SLO.p95Ms} ms por endpoint, sin login) | ${critRecovery ? 'cumple' : 'NO cumple'} | p95 máx. ${fmt(recovery.maxP95)} ms |`,
    '',
    '## Por nivel',
    '',
    '| Nivel | Objetivo it/s | it/s medidos | req/s | descartadas (estim.) | http_req_failed | checks fallidos | p95 máx. API | SLO-1 |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.l.tag} | ${fmt(r.l.rate, 2)} | ${fmt(r.itPerS, 2)} | ${fmt(r.reqPerS, 1)} | ${r.droppedEst} | ${fmt((r.failed ?? NaN) * 100, 2)}% | ${fmt((r.checksFailed ?? NaN) * 100, 2)}% | ${fmt(r.maxP95)} | ${r.slo1 ? 'cumple' : 'no cumple'} |`,
    ),
    '',
    '## Latencias por endpoint y nivel (ms)',
    '',
    '| Nivel | Endpoint | p50 | p90 | p95 | p99 |',
    '|---|---|---|---|---|---|',
    ...rows.flatMap((r) =>
      USED_ENDPOINTS.map((n) => {
        const v = r.lat[n]
        return `| ${r.l.tag} | ${n} | ${fmt(v?.['p(50)'])} | ${fmt(v?.['p(90)'])} | ${fmt(v?.['p(95)'])} | ${fmt(v?.['p(99)'])} |`
      }),
    ),
    '',
    'Descartadas (estim.) = objetivo × ventana − iteraciones iniciadas del nivel; `dropped_iterations` no admite tag de nivel. La ventana incluye la rampa previa. El login es informativo (bcrypt).',
    '',
  ]
  const md = lines.join('\n')
  return {
    'perf/results/stress.summary.json': JSON.stringify(data, null, 2),
    'perf/results/stress.levels.json': JSON.stringify(levelsJson, null, 2),
    'perf/results/stress.slo.md': md,
    stdout: `\n${md}\n`,
  }
}
