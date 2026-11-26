import exec from 'k6/execution'
import { Counter } from 'k6/metrics'
import { ENDPOINTS, SLO, SUMMARY_TREND_STATS } from './lib/config.js'
import { browseFeed, createReport } from './lib/flows.js'
import { onBeforeRequest } from './lib/http.js'

// punto de quiebre B: modelo abierto, escalones de tasa de arribo (it/s)
const SCALE = Number(__ENV.PERF_SCALE ?? 1)
const START_RATE = Number(__ENV.BP_START_RATE ?? 2)
const RATE_STEP = Number(__ENV.BP_RATE_STEP ?? 2)
const STEPS = Number(__ENV.BP_STEPS ?? 10)
const STEP_S = Math.max(5, Math.round(Number(__ENV.BP_STEP_S ?? 120 * SCALE)))
const RAMP_S = 1
const WINDOW_S = STEP_S + RAMP_S
const VISITOR_WEIGHT = Number(__ENV.BP_VISITOR_WEIGHT ?? 80)
const PRE_VUS = Number(__ENV.BP_PRE_VUS ?? 100)
const MAX_VUS = Number(__ENV.BP_MAX_VUS ?? 500)
const THINK = [Number(__ENV.THINK_MIN ?? 0.2), Number(__ENV.THINK_MAX ?? 0.5)]

const rates = Array.from({ length: STEPS }, (_, i) => START_RATE + i * RATE_STEP)
const stepTag = (i) => `s${i + 1}`
const API_ENDPOINTS = ENDPOINTS.filter((e) => e !== 'login')
const USED_ENDPOINTS = ['feed', 'detail', 'login', 'create']

const started = new Counter('bp_iterations_started')

// submétricos por escalón (thresholds vacíos para que k6 los exponga)
const submetrics = {}
for (let i = 0; i < STEPS; i++) {
  const t = stepTag(i)
  for (const name of USED_ENDPOINTS) submetrics[`http_req_duration{name:${name},step:${t}}`] = []
  for (const m of ['http_reqs', 'http_req_failed', 'checks', 'bp_iterations_started']) submetrics[`${m}{step:${t}}`] = []
}

// SLO-1 y SLO-3 globales con corte anticipado
const abort = (threshold) => ({ threshold, abortOnFail: true, delayAbortEval: '30s' })
const sloThresholds = {}
for (const name of API_ENDPOINTS) sloThresholds[`http_req_duration{name:${name}}`] = [abort(`p(95)<${SLO.p95Ms}`)]
sloThresholds.http_req_failed = [abort(`rate<${SLO.errorRate}`)]
sloThresholds.checks = [abort(`rate>${1 - SLO.errorRate}`)]

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: Math.round(START_RATE * 10),
      timeUnit: '10s', // k6 exige tasas enteras: se expresa en it/10 s para admitir 0,1 it/s
      preAllocatedVUs: PRE_VUS,
      maxVUs: MAX_VUS,
      stages: rates.flatMap((r) => [
        { target: Math.round(r * 10), duration: `${RAMP_S}s` },
        { target: Math.round(r * 10), duration: `${STEP_S}s` },
      ]),
      gracefulStop: '30s',
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: { ...submetrics, ...sloThresholds },
}

function stepIndexAt(elapsedS) {
  return Math.min(STEPS - 1, Math.max(0, Math.floor(elapsedS / WINDOW_S)))
}

// etiqueta cada request con el escalón vigente
let currentTag = null
onBeforeRequest(() => {
  const tag = stepTag(stepIndexAt((Date.now() - exec.scenario.startTime) / 1000))
  if (tag !== currentTag) {
    currentTag = tag
    exec.vu.tags.step = tag
  }
})

export default function () {
  const tag = stepTag(stepIndexAt((Date.now() - exec.scenario.startTime) / 1000))
  started.add(1, { step: tag })
  if (Math.random() * 100 < VISITOR_WEIGHT) browseFeed(THINK)
  else createReport(THINK, { pollAttempts: 0 })
}

// ---- resumen por escalón ----
const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')

function stepRow(data, i) {
  const t = stepTag(i)
  const m = data.metrics
  const reqs = values(m[`http_reqs{step:${t}}`])?.count ?? 0
  const iters = values(m[`bp_iterations_started{step:${t}}`])?.count ?? 0
  const p95 = {}
  for (const name of USED_ENDPOINTS) {
    const v = values(m[`http_req_duration{name:${name},step:${t}}`])
    p95[name] = v && v.max > 0 ? v['p(95)'] : undefined
  }
  const apiP95 = API_ENDPOINTS.map((n) => p95[n]).filter((x) => x !== undefined)
  const maxP95 = apiP95.length ? Math.max(...apiP95) : undefined
  const failed = values(m[`http_req_failed{step:${t}}`])?.rate
  const checks = values(m[`checks{step:${t}}`])?.rate
  const checksFailed = typeof checks === 'number' ? 1 - checks : undefined
  const measured = reqs > 0
  const ok = measured && maxP95 !== undefined && maxP95 < SLO.p95Ms && failed < SLO.errorRate && checksFailed < SLO.errorRate
  return { i, rate: rates[i], reqs, iters, p95, maxP95, failed, checksFailed, measured, ok, itPerS: iters / WINDOW_S, reqPerS: reqs / WINDOW_S }
}

export function handleSummary(data) {
  const rows = Array.from({ length: STEPS }, (_, i) => stepRow(data, i)).filter((r) => r.measured)
  let last = null
  for (const r of rows) {
    if (!r.ok) break
    last = r
  }
  const firstFail = rows.find((r) => !r.ok)
  const dropped = values(data.metrics.dropped_iterations)?.count ?? 0
  const lines = [
    '# Resumen breakpoint',
    '',
    `Modelo abierto ramping-arrival-rate: inicio ${START_RATE} it/s, paso +${RATE_STEP} it/s, ${STEPS} escalones de ${STEP_S} s (+${RAMP_S} s de rampa), mezcla ${VISITOR_WEIGHT}/${100 - VISITOR_WEIGHT} visitante/creación, VUs ${PRE_VUS}..${MAX_VUS}.`,
    `Duración medida: ${fmt(data.state?.testRunDurationMs / 1000, 1)} s. Pico de VUs: ${values(data.metrics.vus_max)?.max ?? 'n/d'}. dropped_iterations total: ${dropped}.`,
    '',
    '## Capacidad',
    last
      ? `Último escalón que cumple SLO-1 y SLO-3: ${last.rate} it/s (medido ${fmt(last.itPerS, 2)} it/s, ${fmt(last.reqPerS, 1)} req/s).`
      : 'Ningún escalón cumple SLO-1 y SLO-3: capacidad < tasa inicial.',
    firstFail ? `Primer escalón que falla: ${firstFail.rate} it/s (medido ${fmt(firstFail.itPerS, 2)} it/s, ${fmt(firstFail.reqPerS, 1)} req/s).` : 'Ningún escalón falló.',
    '',
    '## Por escalón',
    '',
    '| Escalón | Objetivo it/s | it/s medidos | req/s | p95 feed | p95 detail | p95 create | p95 login (informativo) | http_req_failed | checks fallidos | SLO-1/3 |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${stepTag(r.i)} | ${r.rate} | ${fmt(r.itPerS, 2)} | ${fmt(r.reqPerS, 1)} | ${fmt(r.p95.feed)} | ${fmt(r.p95.detail)} | ${fmt(r.p95.create)} | ${fmt(r.p95.login)} | ${fmt((r.failed ?? NaN) * 100, 2)}% | ${fmt((r.checksFailed ?? NaN) * 100, 2)}% | ${r.ok ? 'cumple' : 'no cumple'} |`,
    ),
    '',
    'Las iteraciones iniciadas por escalón (it/s medidos) frente al objetivo indican descartes; `dropped_iterations` no admite tag de escalón.',
    '',
  ]
  const md = lines.join('\n')
  return {
    'perf/results/breakpoint.summary.json': JSON.stringify(data, null, 2),
    'perf/results/breakpoint.slo.md': md,
    stdout: `\n${md}\n`,
  }
}
