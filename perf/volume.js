import exec from 'k6/execution'
import { Trend } from 'k6/metrics'
import { SLO, SUMMARY_TREND_STATS } from './lib/config.js'
import { checkStep, get, json, onBeforeRequest } from './lib/http.js'
import { login } from './lib/flows.js'
import { randomReportId } from './lib/users.js'
import { think } from './lib/think.js'
import { checksTable, evaluateSlo, sloTable } from './lib/summary.js'

// volumen V: misma carga con la base a 1x y 10x (VOLUME_LABEL)
const SCALE = Number(__ENV.PERF_SCALE ?? 1)
const LABEL = __ENV.VOLUME_LABEL ?? '1x'
const RATE = Number(__ENV.VOLUME_RATE ?? 3)
const WARMUP_S = Math.max(1, Math.round(Number(__ENV.VOLUME_WARMUP_S ?? 60 * SCALE)))
const MEASURE_S = Math.max(5, Math.round(Number(__ENV.VOLUME_MEASURE_S ?? 300 * SCALE)))
const VISITOR_WEIGHT = Number(__ENV.VOLUME_VISITOR_WEIGHT ?? 70)
const PRE_VUS = Number(__ENV.VOLUME_PRE_VUS ?? 50)
const MAX_VUS = Number(__ENV.VOLUME_MAX_VUS ?? 300)
const THINK = [Number(__ENV.THINK_MIN ?? 0.2), Number(__ENV.THINK_MAX ?? 0.5)]

const NAMES = ['feed', 'detail', 'mine', 'notifications', 'login']
const API_NAMES = NAMES.filter((n) => n !== 'login')
const BYTES_NAMES = ['feed', 'detail', 'mine', 'notifications']
const MEASURE = 'measure'

// tamaño de respuesta por endpoint (solo fase medida)
const bodyBytes = {}
for (const n of BYTES_NAMES) bodyBytes[n] = new Trend(`${n}_body_bytes`)

// submétricos de la fase medida (thresholds vacíos para exponerlos)
const submetrics = {}
for (const n of NAMES) {
  submetrics[`http_req_duration{name:${n},step:${MEASURE}}`] = []
  submetrics[`http_req_failed{name:${n},step:${MEASURE}}`] = []
}
for (const m of ['http_reqs', 'http_req_failed', 'checks', 'apdex_total', 'apdex_satisfied', 'apdex_tolerating']) {
  submetrics[`${m}{step:${MEASURE}}`] = []
}

// SLO-1 por endpoint y SLO-3 solo sobre la fase medida
const sloThresholds = {}
for (const n of API_NAMES) sloThresholds[`http_req_duration{name:${n},step:${MEASURE}}`] = [`p(95)<${SLO.p95Ms}`]
sloThresholds[`http_req_failed{step:${MEASURE}}`] = [`rate<${SLO.errorRate}`]
sloThresholds[`checks{step:${MEASURE}}`] = [`rate>${1 - SLO.errorRate}`]

export const options = {
  scenarios: {
    volume: {
      executor: 'constant-arrival-rate',
      rate: Math.round(RATE * 10),
      timeUnit: '10s', // tasas enteras: it/10 s admite fracciones de it/s
      duration: `${WARMUP_S + MEASURE_S}s`,
      preAllocatedVUs: PRE_VUS,
      maxVUs: MAX_VUS,
      gracefulStop: '30s',
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: { ...submetrics, ...sloThresholds },
}

const phaseAt = (elapsedS) => (elapsedS < WARMUP_S ? 'warmup' : MEASURE)
const measuring = () => phaseAt((Date.now() - exec.scenario.startTime) / 1000) === MEASURE

// etiqueta cada request con la fase vigente
let currentPhase = null
onBeforeRequest(() => {
  const phase = phaseAt((Date.now() - exec.scenario.startTime) / 1000)
  if (phase !== currentPhase) {
    currentPhase = phase
    exec.vu.tags.step = phase
  }
})

function track(name, res) {
  if (measuring() && res.body) bodyBytes[name].add(res.body.length)
}

// visitante: feed + detalle x2-3
function visitor() {
  const feed = get('feed', '/api/reports')
  checkStep(feed, 'feed', 200, (b) => Array.isArray(b) && b.length > 0)
  track('feed', feed)
  const list = json(feed)
  const opens = 2 + Math.floor(Math.random() * 2)
  for (let i = 0; i < opens; i++) {
    think(...THINK)
    const id = Array.isArray(list) && list.length ? list[Math.floor(Math.random() * list.length)].id : randomReportId()
    const detail = get('detail', `/api/reports/${id}`)
    checkStep(detail, 'detail', 200, (b) => b.id === id && b.location !== undefined)
    track('detail', detail)
  }
}

// usuario: login, mis reportes y notificaciones
function member() {
  const token = login()
  if (!token) return
  think(...THINK)
  const mine = get('mine', '/api/reports/mine', token)
  checkStep(mine, 'mine', 200, (b) => Array.isArray(b))
  track('mine', mine)
  think(...THINK)
  const notifications = get('notifications', '/api/notifications', token)
  checkStep(notifications, 'notifications', 200, (b) => Array.isArray(b.items))
  track('notifications', notifications)
}

export default function () {
  if (Math.random() * 100 < VISITOR_WEIGHT) visitor()
  else member()
}

// ---- resumen ----
const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')

// proyecta la fase medida sobre los nombres que espera evaluateSlo
function projectMeasure(data) {
  const m = {}
  for (const n of NAMES) m[`http_req_duration{name:${n}}`] = data.metrics[`http_req_duration{name:${n},step:${MEASURE}}`]
  for (const k of ['http_req_failed', 'checks', 'apdex_total', 'apdex_satisfied', 'apdex_tolerating']) m[k] = data.metrics[`${k}{step:${MEASURE}}`]
  return { metrics: m }
}

export function handleSummary(data) {
  const slo = evaluateSlo(projectMeasure(data))
  // evaluateSlo solo conoce ENDPOINTS: SLO-1 se recalcula incluyendo notifications
  const p95s = API_NAMES.map((n) => values(data.metrics[`http_req_duration{name:${n},step:${MEASURE}}`])).filter((d) => d && d.max > 0).map((d) => d['p(95)'])
  const worst = Math.max(...p95s, 0)
  slo[0] = { ...slo[0], value: `${fmt(worst)} ms (peor endpoint)`, ok: p95s.length > 0 && worst < SLO.p95Ms }
  const reqs = values(data.metrics[`http_reqs{step:${MEASURE}}`])?.count ?? 0
  const rows = NAMES.map((n) => {
    const d = values(data.metrics[`http_req_duration{name:${n},step:${MEASURE}}`])
    if (!d || !(d.max > 0)) return null
    const failed = values(data.metrics[`http_req_failed{name:${n},step:${MEASURE}}`])?.rate
    const b = values(data.metrics[`${n}_body_bytes`])
    return `| ${n} | ${fmt(d['p(50)'] ?? d.med, 1)} | ${fmt(d['p(95)'], 1)} | ${fmt(d['p(99)'], 1)} | ${fmt((failed ?? NaN) * 100, 2)}% | ${typeof b?.avg === 'number' ? fmt(b.avg) : 'n/d'} |`
  }).filter(Boolean)
  const md = [
    `# Resumen volume ${LABEL}`,
    '',
    `Modelo abierto constant-arrival-rate ${RATE} it/s, mezcla ${VISITOR_WEIGHT}/${100 - VISITOR_WEIGHT} visitante/usuario (login + mine + notifications). Warm-up ${WARMUP_S} s (no se cuenta) + medición ${MEASURE_S} s, VUs ${PRE_VUS}..${MAX_VUS}.`,
    `Duración medida: ${fmt(data.state?.testRunDurationMs / 1000, 1)} s. Pico de VUs: ${values(data.metrics.vus_max)?.max ?? 'n/d'}. dropped_iterations: ${values(data.metrics.dropped_iterations)?.count ?? 0}. Requests en la fase medida: ${reqs}.`,
    '',
    `## SLO (solo fase medida, volumen ${LABEL})`,
    sloTable(slo),
    '',
    '## Por endpoint (fase medida)',
    '',
    '| Endpoint | p50 (ms) | p95 (ms) | p99 (ms) | error | body promedio (bytes) |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Checks (toda la corrida)',
    checksTable(data),
    '',
  ].join('\n')
  return {
    [`perf/results/volume.${LABEL}.summary.json`]: JSON.stringify(data, null, 2),
    [`perf/results/volume.${LABEL}.slo.md`]: md,
    stdout: `\n${md}\n`,
  }
}
