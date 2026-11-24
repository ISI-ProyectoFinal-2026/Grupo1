import exec from 'k6/execution'
import { Counter } from 'k6/metrics'
import http from 'k6/http'
import { BASE_URL, SLO, SUMMARY_TREND_STATS } from './lib/config.js'
import { browseFeed } from './lib/flows.js'
import { onBeforeRequest } from './lib/http.js'

// escalabilidad C: punto de quiebre B (escalones de tasa de arribo) solo visitante, sobre N instancias tras un balanceador
const LABEL = __ENV.SC_LABEL ?? '1cpu'
const START_RATE = Number(__ENV.SC_START_RATE ?? 10)
const RATE_STEP = Number(__ENV.SC_RATE_STEP ?? 5)
const STEPS = Number(__ENV.SC_STEPS ?? 8)
const STEP_S = Math.max(5, Number(__ENV.SC_STEP_S ?? 45))
const RAMP_S = 1
const WINDOW_S = STEP_S + RAMP_S
const PRE_VUS = Number(__ENV.SC_PRE_VUS ?? 200)
const MAX_VUS = Number(__ENV.SC_MAX_VUS ?? 1500)
const DELIVERED_MIN = 0.95 // fracción mínima de la tasa objetivo efectivamente iniciada
const THINK = [Number(__ENV.THINK_MIN ?? 0.2), Number(__ENV.THINK_MAX ?? 0.5)]

const rates = Array.from({ length: STEPS }, (_, i) => START_RATE + i * RATE_STEP)
const stepTag = (i) => `s${i + 1}`
const API_ENDPOINTS = ['feed', 'detail']
const started = new Counter('sc_iterations_started')

// submétricos por escalón (thresholds vacíos para que k6 los exponga)
const submetrics = {}
for (let i = 0; i < STEPS; i++) {
  const t = stepTag(i)
  for (const name of API_ENDPOINTS) submetrics[`http_req_duration{name:${name},step:${t}}`] = []
  for (const m of ['http_reqs', 'http_req_failed', 'checks', 'sc_iterations_started']) submetrics[`${m}{step:${t}}`] = []
}

export const options = {
  scenarios: {
    scalability: {
      executor: 'ramping-arrival-rate',
      startRate: Math.round(START_RATE * 10),
      timeUnit: '10s', // tasas enteras en it/10 s (admite pasos de 0,1 it/s)
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
  thresholds: submetrics,
}

const stepIndexAt = (elapsedS) => Math.min(STEPS - 1, Math.max(0, Math.floor(elapsedS / WINDOW_S)))

// instante de arranque del escenario, para alinear el CSV de recursos
export function setup() {
  for (let i = 0; i < 40; i++) http.get(`${BASE_URL}/api/reports`) // calentamiento (JIT, pool de Prisma) fuera de la medición
  console.log(`SC_START_MS=${Date.now()}`)
}

let currentTag = null
onBeforeRequest(() => {
  const tag = stepTag(stepIndexAt((Date.now() - exec.scenario.startTime) / 1000))
  if (tag !== currentTag) {
    currentTag = tag
    exec.vu.tags.step = tag
  }
})

export default function () {
  started.add(1, { step: stepTag(stepIndexAt((Date.now() - exec.scenario.startTime) / 1000)) })
  browseFeed(THINK)
}

// ---- resumen por escalón ----
const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')

function stepRow(data, i) {
  const t = stepTag(i)
  const m = data.metrics
  const reqs = values(m[`http_reqs{step:${t}}`])?.count ?? 0
  const iters = values(m[`sc_iterations_started{step:${t}}`])?.count ?? 0
  const p95 = {}
  for (const name of API_ENDPOINTS) {
    const v = values(m[`http_req_duration{name:${name},step:${t}}`])
    p95[name] = v && v.max > 0 ? v['p(95)'] : undefined
  }
  const known = API_ENDPOINTS.map((n) => p95[n]).filter((x) => x !== undefined)
  const maxP95 = known.length ? Math.max(...known) : undefined
  const failed = values(m[`http_req_failed{step:${t}}`])?.rate
  const checks = values(m[`checks{step:${t}}`])?.rate
  const checksFailed = typeof checks === 'number' ? 1 - checks : undefined
  const itPerS = iters / WINDOW_S
  const delivered = itPerS / rates[i]
  const sloOk = reqs > 0 && maxP95 !== undefined && maxP95 < SLO.p95Ms && failed < SLO.errorRate && checksFailed < SLO.errorRate
  return { i, step: t, rate: rates[i], reqs, iters, p95, maxP95, failed, checksFailed, itPerS, reqPerS: reqs / WINDOW_S, delivered, measured: reqs > 0, sloOk, ok: sloOk && delivered >= DELIVERED_MIN }
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
    `# Resumen escalabilidad (${LABEL})`,
    '',
    `Modelo abierto ramping-arrival-rate, solo visitante (feed + 2-3 detalles): inicio ${START_RATE} it/s, paso +${RATE_STEP} it/s, ${STEPS} escalones de ${STEP_S} s (+${RAMP_S} s de rampa), VUs ${PRE_VUS}..${MAX_VUS}.`,
    `Duración medida: ${fmt(data.state?.testRunDurationMs / 1000, 1)} s. Pico de VUs: ${values(data.metrics.vus_max)?.max ?? 'n/d'}. dropped_iterations total: ${dropped}.`,
    '',
    '## Capacidad',
    last ? `Último escalón que cumple SLO-1, SLO-3 y entrega >= ${DELIVERED_MIN * 100} % de la tasa: ${last.rate} it/s (medido ${fmt(last.itPerS, 2)} it/s, ${fmt(last.reqPerS, 1)} req/s).` : 'Ningún escalón cumple: capacidad < tasa inicial.',
    firstFail ? `Primer escalón que falla: ${firstFail.rate} it/s (medido ${fmt(firstFail.itPerS, 2)} it/s, ${fmt(firstFail.reqPerS, 1)} req/s).` : 'Ningún escalón falló.',
    '',
    '## Por escalón',
    '',
    '| Escalón | Objetivo it/s | it/s medidos | Entrega | req/s | p95 feed | p95 detail | http_req_failed | checks fallidos | SLO-1/3 | Cumple |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.step} | ${r.rate} | ${fmt(r.itPerS, 2)} | ${fmt(r.delivered * 100, 0)}% | ${fmt(r.reqPerS, 1)} | ${fmt(r.p95.feed)} | ${fmt(r.p95.detail)} | ${fmt((r.failed ?? NaN) * 100, 2)}% | ${fmt((r.checksFailed ?? NaN) * 100, 2)}% | ${r.sloOk ? 'cumple' : 'no cumple'} | ${r.ok ? 'sí' : 'no'} |`,
    ),
    '',
  ]
  const md = lines.join('\n')
  const meta = { label: LABEL, startRate: START_RATE, rateStep: RATE_STEP, steps: STEPS, stepS: STEP_S, windowS: WINDOW_S, deliveredMin: DELIVERED_MIN, dropped, capacity: last, firstFail: firstFail ?? null, rows }
  return {
    [`perf/results/scalability.${LABEL}.summary.json`]: JSON.stringify(data, null, 2),
    [`perf/results/scalability.${LABEL}.steps.json`]: JSON.stringify(meta, null, 2),
    [`perf/results/scalability.${LABEL}.slo.md`]: md,
    stdout: `\n${md}\n`,
  }
}
