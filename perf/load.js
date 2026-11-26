import exec from 'k6/execution'
import { ENDPOINTS, SLO, SUMMARY_TREND_STATS } from './lib/config.js'
import { browseFeed, createReport, loginAndMe, myReportsAndMatches } from './lib/flows.js'
import { onBeforeRequest } from './lib/http.js'
import { checksTable, evaluateSlo, sloTable } from './lib/summary.js'

// escala de las duraciones (1 = corrida completa de ~29 min)
const SCALE = Number(__ENV.PERF_SCALE ?? 1)

// etapas base: [segundos, VUs destino, paso evaluado]
const BASE_STAGES = [
  [120, 100, 'ramp'],
  [300, 100, '100'],
  [120, 200, 'ramp'],
  [600, 200, '200'],
  [180, 500, 'ramp'],
  [300, 500, '500'],
  [120, 0, 'ramp'],
]
const STAGES = BASE_STAGES.map(([s, target, step]) => ({ s: Math.max(1, Math.round(s * SCALE)), target, step }))
const STEPS = ['100', '200', '500']
const EVALUATED_STEP = '200'

// mezcla del issue sin flyer (8 %) ni chat (7 %): se re-normaliza sobre el 85 % restante
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

// paso según el tiempo transcurrido del escenario
function stepAt(elapsedS) {
  let acc = 0
  for (const st of STAGES) {
    acc += st.s
    if (elapsedS < acc) return st.step
  }
  return 'ramp'
}

const submetrics = {}
const stepFilter = (s) => `{step:${s}}`
for (const s of STEPS) {
  for (const name of ENDPOINTS) submetrics[`http_req_duration{name:${name},step:${s}}`] = []
  submetrics[`http_reqs${stepFilter(s)}`] = []
  submetrics[`http_req_failed${stepFilter(s)}`] = []
  submetrics[`checks${stepFilter(s)}`] = []
  for (const c of ['apdex_total', 'apdex_satisfied', 'apdex_tolerating']) submetrics[`${c}${stepFilter(s)}`] = []
}

// SLO-1/3/4 solo sobre el paso de 200 VUs (SLO-5 se evalúa en el resumen)
const sloThresholds = {}
for (const name of ENDPOINTS.filter((e) => e !== 'login')) {
  sloThresholds[`http_req_duration{name:${name},step:${EVALUATED_STEP}}`] = [`p(95)<${SLO.p95Ms}`, `p(99)<${SLO.p99Ms}`]
}
sloThresholds[`http_req_failed{step:${EVALUATED_STEP}}`] = [`rate<${SLO.errorRate}`]
sloThresholds[`checks{step:${EVALUATED_STEP}}`] = [`rate>${1 - SLO.errorRate}`]

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: STAGES.map((st) => ({ duration: `${st.s}s`, target: st.target })),
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: { ...submetrics, ...sloThresholds },
}

// etiqueta cada request con el paso vigente
let currentStep = null
onBeforeRequest(() => {
  const step = stepAt((Date.now() - exec.scenario.startTime) / 1000)
  if (step !== currentStep) {
    currentStep = step
    exec.vu.tags.step = step
  }
})

export default function () {
  pickFlow()([Number(__ENV.THINK_MIN ?? 3), Number(__ENV.THINK_MAX ?? 8)])
}

// ---- resumen por paso ----
const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')

// proyecta las métricas de un paso sobre los nombres que espera evaluateSlo
function projectStep(data, step) {
  const m = {}
  for (const name of ENDPOINTS) m[`http_req_duration{name:${name}}`] = data.metrics[`http_req_duration{name:${name},step:${step}}`]
  for (const k of ['http_req_failed', 'checks', 'apdex_total', 'apdex_satisfied', 'apdex_tolerating']) m[k] = data.metrics[`${k}{step:${step}}`]
  m.matching_duration = data.metrics.matching_duration
  return { metrics: m }
}

function holdSeconds(step) {
  return STAGES.find((st) => st.step === step)?.s ?? 0
}

function stepSection(data, step) {
  const p = projectStep(data, step)
  const reqs = values(data.metrics[`http_reqs{step:${step}}`])?.count ?? 0
  const secs = holdSeconds(step)
  const failed = values(p.metrics.http_req_failed)?.rate
  const checks = values(p.metrics.checks)?.rate
  const slo = evaluateSlo(p)
  const apdex = slo.find((r) => r.id === 'SLO-5').value
  const lines = [
    `### Paso ${step} VUs (meseta de ${secs} s)`,
    '',
    `Requests: ${reqs} (${fmt(reqs / secs, 1)} req/s), http_req_failed ${fmt((failed ?? NaN) * 100, 2)}%, checks fallidos ${fmt((1 - (checks ?? NaN)) * 100, 2)}%, Apdex ${apdex}`,
    '',
    '| Endpoint | p50 | p90 | p95 | p99 | max |',
    '|---|---|---|---|---|---|',
  ]
  for (const name of ENDPOINTS) {
    const v = values(p.metrics[`http_req_duration{name:${name}}`])
    if (!v || !(v.max > 0)) continue
    lines.push(`| ${name} | ${fmt(v['p(50)'] ?? v.med, 1)} | ${fmt(v['p(90)'], 1)} | ${fmt(v['p(95)'], 1)} | ${fmt(v['p(99)'], 1)} | ${fmt(v.max, 1)} |`)
  }
  return lines.join('\n')
}

export function handleSummary(data) {
  const evaluated = evaluateSlo(projectStep(data, EVALUATED_STEP))
  const md = [
    '# Resumen load',
    '',
    `Escala PERF_SCALE=${SCALE}. Etapas: ${STAGES.map((st) => `${st.target} VUs/${st.s}s`).join(' -> ')} (total ${STAGES.reduce((a, st) => a + st.s, 0)} s).`,
    `Duración medida: ${fmt(data.state?.testRunDurationMs / 1000, 1)} s. Pico de VUs: ${values(data.metrics.vus_max)?.max ?? 'n/d'}.`,
    '',
    `## SLO (solo el paso de ${EVALUATED_STEP} VUs; 100 y 500 son informativos)`,
    sloTable(evaluated),
    '',
    '## Detalle por paso',
    '',
    ...STEPS.flatMap((s) => [stepSection(data, s), '']),
    '## Checks (toda la corrida)',
    checksTable(data),
    '',
  ].join('\n')
  return {
    'perf/results/load.summary.json': JSON.stringify(data, null, 2),
    'perf/results/load.slo.md': md,
    stdout: `\n${md}\n`,
  }
}
