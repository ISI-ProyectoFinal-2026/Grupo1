import exec from 'k6/execution'
import { SLO, SUMMARY_TREND_STATS } from './lib/config.js'
import { browseFeed, createReport, loginAndMe, myReportsAndMatches } from './lib/flows.js'
import { onBeforeRequest } from './lib/http.js'
import { checksTable, endpointSubmetrics, evaluateSlo, sloTable } from './lib/summary.js'

// resistencia E: modelo abierto a tasa constante (70 % de la capacidad de T5) con rampas de subida y bajada
const RATE = Number(__ENV.SOAK_RATE ?? 3.15) // it/s (0,7 x 4,5 it/s medidos en T5)
const TOTAL_MIN = Number(__ENV.SOAK_MINUTES ?? 240) // el issue pide 4 h
const RAMP_MIN = Number(__ENV.SOAK_RAMP_MIN ?? 5)
const PRE_VUS = Number(__ENV.SOAK_PRE_VUS ?? 150)
const MAX_VUS = Number(__ENV.SOAK_MAX_VUS ?? 500)
const THINK = [Number(__ENV.THINK_MIN ?? 3), Number(__ENV.THINK_MAX ?? 8)]
const GROWTH_LIMIT = 1.1 // p95 del último tercio <= 110 % del primero

const RAMP_S = Math.round(RAMP_MIN * 60)
const TOTAL_S = Math.round(TOTAL_MIN * 60)
const STEADY_S = TOTAL_S - 2 * RAMP_S
const THIRD_S = STEADY_S / 3
const THIRDS = ['t1', 't2', 't3']
const USED = ['feed', 'detail', 'login', 'mine', 'matches', 'create', 'me']
const API_USED = USED.filter((e) => e !== 'login')

if (STEADY_S < 30) throw new Error('SOAK_MINUTES demasiado corto para las rampas')

// load.js sin flyer (8 %) ni chat (7 %): pesos re-normalizados sobre el 85 % restante
const MIX = [
  { weight: 55, run: browseFeed },
  { weight: 15, run: myReportsAndMatches },
  { weight: 10, run: (t) => createReport(t, { pollAttempts: 3, pollIntervalS: 1 }) },
  { weight: 5, run: loginAndMe },
]
const TOTAL_WEIGHT = MIX.reduce((a, m) => a + m.weight, 0)

function pickFlow() {
  let r = Math.random() * TOTAL_WEIGHT
  for (const m of MIX) {
    if ((r -= m.weight) < 0) return m.run
  }
  return MIX[0].run
}

// tasas enteras en it/100 s para admitir 3,15 it/s
const rateOf = (r) => Math.round(r * 100)

// submétricos por tercio (thresholds vacíos para que k6 los exponga)
const submetrics = { ...endpointSubmetrics() }
for (const t of THIRDS) {
  for (const name of USED) submetrics[`http_req_duration{name:${name},third:${t}}`] = []
  for (const m of ['http_reqs', 'http_req_failed', 'checks', 'apdex_total', 'apdex_satisfied', 'apdex_tolerating']) submetrics[`${m}{third:${t}}`] = []
}

// SLO-1/3/4 sobre toda la corrida, sin abortOnFail
const sloThresholds = {}
for (const name of API_USED) sloThresholds[`http_req_duration{name:${name}}`] = [`p(95)<${SLO.p95Ms}`, `p(99)<${SLO.p99Ms}`]
sloThresholds.http_req_failed = [`rate<${SLO.errorRate}`]
sloThresholds.checks = [`rate>${1 - SLO.errorRate}`]

export const options = {
  scenarios: {
    soak: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '100s',
      preAllocatedVUs: PRE_VUS,
      maxVUs: MAX_VUS,
      stages: [
        { target: rateOf(RATE), duration: `${RAMP_S}s` },
        { target: rateOf(RATE), duration: `${STEADY_S}s` },
        { target: 0, duration: `${RAMP_S}s` },
      ],
      gracefulStop: '60s',
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: { ...submetrics, ...sloThresholds },
}

// instante de arranque para alinear el CSV de recursos
export function setup() {
  console.log(`SOAK_START_MS=${Date.now()}`)
}

// tercio según el tiempo transcurrido del escenario
function thirdAt(elapsedS) {
  if (elapsedS < RAMP_S || elapsedS >= RAMP_S + STEADY_S) return 'ramp'
  return THIRDS[Math.min(2, Math.floor((elapsedS - RAMP_S) / THIRD_S))]
}

let currentThird = null
onBeforeRequest(() => {
  const third = thirdAt((Date.now() - exec.scenario.startTime) / 1000)
  if (third !== currentThird) {
    currentThird = third
    exec.vu.tags.third = third
  }
})

export default function () {
  pickFlow()(THINK)
}

// ---- resumen ----
const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')

function thirdStat(data, name, t) {
  const v = values(data.metrics[`http_req_duration{name:${name},third:${t}}`])
  return v && v.max > 0 ? v : undefined
}

function endpointRows(data) {
  return USED.map((name) => {
    const s = THIRDS.map((t) => thirdStat(data, name, t))
    const p95 = s.map((v) => v?.['p(95)'])
    const p99 = s.map((v) => v?.['p(99)'])
    const ratio = p95[0] > 0 && p95[2] !== undefined ? p95[2] / p95[0] : undefined
    return { name, p95, p99, ratio, count: s.map((v) => v?.count) }
  })
}

function thirdTotals(data) {
  return THIRDS.map((t) => {
    const reqs = values(data.metrics[`http_reqs{third:${t}}`])?.count ?? 0
    const failed = values(data.metrics[`http_req_failed{third:${t}}`])?.rate
    const checks = values(data.metrics[`checks{third:${t}}`])?.rate
    const total = values(data.metrics[`apdex_total{third:${t}}`])?.count ?? 0
    const sat = values(data.metrics[`apdex_satisfied{third:${t}}`])?.count ?? 0
    const tol = values(data.metrics[`apdex_tolerating{third:${t}}`])?.count ?? 0
    return { t, reqs, reqPerS: reqs / THIRD_S, failed, checksFailed: typeof checks === 'number' ? 1 - checks : undefined, apdex: total ? (sat + tol / 2) / total : undefined }
  })
}

export function handleSummary(data) {
  const slo = evaluateSlo(data)
  const rows = endpointRows(data)
  const api = rows.filter((r) => r.name !== 'login' && r.ratio !== undefined)
  const worst = api.reduce((a, r) => (a === null || r.ratio > a.ratio ? r : a), null)
  const growthOk = worst ? worst.ratio <= GROWTH_LIMIT : null
  const totals = thirdTotals(data)
  const reqs = values(data.metrics.http_reqs)
  const dropped = values(data.metrics.dropped_iterations)?.count ?? 0
  const iters = values(data.metrics.iterations)?.count ?? 0
  const md = [
    '# Resumen soak',
    '',
    `Modelo abierto ramping-arrival-rate: ${RATE} it/s (70 % de 4,5 it/s de T5), rampa ${RAMP_MIN} min arriba y abajo, fase estable ${fmt(STEADY_S / 60, 1)} min (total ${TOTAL_MIN} min). El issue pide 240 min.`,
    `Tercios de la fase estable (tag \`third\`): t1/t2/t3 de ${fmt(THIRD_S / 60, 2)} min cada uno. Think time ${THINK[0]}-${THINK[1]} s, VUs ${PRE_VUS}..${MAX_VUS}.`,
    `Duración medida: ${fmt(data.state?.testRunDurationMs / 1000, 1)} s. Requests: ${reqs?.count ?? 'n/d'} (${fmt(reqs?.rate, 1)} req/s), iteraciones: ${iters}, dropped_iterations: ${dropped}. Pico de VUs: ${values(data.metrics.vus_max)?.max ?? 'n/d'}.`,
    '',
    '## SLO (toda la corrida, incluidas las rampas)',
    sloTable(slo),
    '',
    `## Degradación: p95 del último tercio <= ${Math.round(GROWTH_LIMIT * 100)} % del primero`,
    '',
    '| Endpoint | p95 t1 | p95 t2 | p95 t3 | t3/t1 | p99 t1 | p99 t2 | p99 t3 | Resultado |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.name}${r.name === 'login' ? ' (informativo)' : ''} | ${r.p95.map((x) => fmt(x, 1)).join(' | ')} | ${fmt(r.ratio, 2)} | ${r.p99.map((x) => fmt(x, 1)).join(' | ')} | ${r.name === 'login' ? '-' : r.ratio === undefined ? 'n/d' : r.ratio <= GROWTH_LIMIT ? 'cumple' : 'no cumple'} |`,
    ),
    '',
    worst
      ? `Peor endpoint (sin login): ${worst.name}, t3/t1 = ${fmt(worst.ratio, 2)} -> ${growthOk ? 'cumple' : 'no cumple'}.`
      : 'Sin datos para evaluar la degradación.',
    '',
    '## Totales por tercio',
    '',
    '| Tercio | Requests | req/s | http_req_failed | checks fallidos | Apdex |',
    '|---|---|---|---|---|---|',
    ...totals.map((x) => `| ${x.t} | ${x.reqs} | ${fmt(x.reqPerS, 1)} | ${fmt((x.failed ?? NaN) * 100, 2)}% | ${fmt((x.checksFailed ?? NaN) * 100, 2)}% | ${fmt(x.apdex, 3)} |`),
    '',
    '## Checks (toda la corrida)',
    checksTable(data),
    '',
  ].join('\n')
  const meta = { rate: RATE, totalMin: TOTAL_MIN, rampMin: RAMP_MIN, rampS: RAMP_S, steadyS: STEADY_S, thirdS: THIRD_S, growthLimit: GROWTH_LIMIT, growthOk, worstEndpoint: worst?.name, worstRatio: worst?.ratio, rows }
  return {
    'perf/results/soak.summary.json': JSON.stringify(data, null, 2),
    'perf/results/soak.meta.json': JSON.stringify(meta, null, 2),
    'perf/results/soak.slo.md': md,
    stdout: `\n${md}\n`,
  }
}
