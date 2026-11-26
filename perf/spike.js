import exec from 'k6/execution'
import http from 'k6/http'
import { Counter, Gauge, Rate } from 'k6/metrics'
import { BASE_URL, SLO, SUMMARY_TREND_STATS } from './lib/config.js'
import { browseFeed } from './lib/flows.js'
import { onBeforeRequest } from './lib/http.js'

// picos P: modelo abierto, base -> x10 en rampa corta -> meseta -> vuelta a la base -> recuperación (solo visitante)
const SCALE = Number(__ENV.PERF_SCALE ?? 1)
const BASE_RATE = Number(__ENV.SPIKE_BASE_RATE ?? 2) // it/s
const FACTOR = Number(__ENV.SPIKE_FACTOR ?? 10)
const PEAK_RATE = BASE_RATE * FACTOR
const BASE_S = Math.max(10, Math.round(Number(__ENV.SPIKE_BASE_S ?? 60 * SCALE)))
const PEAK_S = Math.max(10, Math.round(Number(__ENV.SPIKE_PEAK_S ?? 120 * SCALE)))
const RECOVERY_S = Math.max(40, Math.round(Number(__ENV.SPIKE_RECOVERY_S ?? 180 * SCALE)))
const RAMP_S = Math.max(1, Math.round(Number(__ENV.SPIKE_RAMP_S ?? 10))) // sin escalar
const DRAIN_S = Math.min(RECOVERY_S - 10, Math.max(5, Math.round(Number(__ENV.SPIKE_DRAIN_S ?? 30))))
const WIN_S = 5
const PRE_VUS = Number(__ENV.SPIKE_PRE_VUS ?? 100)
const MAX_VUS = Number(__ENV.SPIKE_MAX_VUS ?? 500)
const ERROR_LIMIT = Number(__ENV.SPIKE_ERROR_LIMIT ?? 0.05)
const THINK = [Number(__ENV.THINK_MIN ?? 0.2), Number(__ENV.THINK_MAX ?? 0.5)]

// tramos (s desde el arranque); el pico incluye ambas rampas
const SPIKE_START_S = BASE_S
const SPIKE_END_S = BASE_S + RAMP_S + PEAK_S + RAMP_S
const TOTAL_S = SPIKE_END_S + RECOVERY_S
const STEPS = [
  { tag: 'base', startS: 0, endS: SPIKE_START_S },
  { tag: 'spike', startS: SPIKE_START_S, endS: SPIKE_END_S },
  { tag: 'recovery_drain', startS: SPIKE_END_S, endS: SPIKE_END_S + DRAIN_S },
  { tag: 'recovery_steady', startS: SPIKE_END_S + DRAIN_S, endS: TOTAL_S },
]

// tasa objetivo (it/s) en el segundo t
function rateAt(t) {
  if (t < BASE_S) return BASE_RATE
  if (t < BASE_S + RAMP_S) return BASE_RATE + ((PEAK_RATE - BASE_RATE) * (t - BASE_S)) / RAMP_S
  if (t < BASE_S + RAMP_S + PEAK_S) return PEAK_RATE
  if (t < SPIKE_END_S) return PEAK_RATE - ((PEAK_RATE - BASE_RATE) * (t - BASE_S - RAMP_S - PEAK_S)) / RAMP_S
  return BASE_RATE
}
const expectedIters = (a, b) => {
  let sum = 0
  for (let t = a; t < b; t += 0.1) sum += rateAt(t + 0.05) * 0.1
  return sum
}

const NWIN = Math.ceil(TOTAL_S / WIN_S)
const winTag = (i) => `w${String(i).padStart(3, '0')}`
const USED_ENDPOINTS = ['feed', 'detail']

const started = new Counter('spike_iterations_started')
const t0Gauge = new Gauge('spike_t0_ms')
const alive = new Rate('spike_alive')

// submétricos por tramo y por ventana de 5 s (thresholds vacíos para que k6 los exponga)
const submetrics = {}
for (const s of STEPS) {
  for (const name of USED_ENDPOINTS) submetrics[`http_req_duration{name:${name},step:${s.tag}}`] = []
  for (const m of ['http_reqs', 'http_req_failed', 'checks', 'spike_iterations_started']) submetrics[`${m}{step:${s.tag}}`] = []
}
for (let i = 0; i < NWIN; i++) {
  for (const name of USED_ENDPOINTS) submetrics[`http_req_duration{name:${name},win:${winTag(i)}}`] = []
  submetrics[`http_reqs{win:${winTag(i)}}`] = []
}

const rateOf = (r) => Math.round(r * 10)

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: rateOf(BASE_RATE),
      timeUnit: '10s', // tasas enteras en it/10 s para admitir fraccionarias
      preAllocatedVUs: PRE_VUS,
      maxVUs: MAX_VUS,
      stages: [
        { target: rateOf(BASE_RATE), duration: `${BASE_S}s` },
        { target: rateOf(PEAK_RATE), duration: `${RAMP_S}s` },
        { target: rateOf(PEAK_RATE), duration: `${PEAK_S}s` },
        { target: rateOf(BASE_RATE), duration: `${RAMP_S}s` },
        { target: rateOf(BASE_RATE), duration: `${RECOVERY_S}s` },
      ],
      gracefulStop: '30s',
      exec: 'spike',
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
  thresholds: { ...submetrics, spike_alive: [], spike_t0_ms: [] },
}

const stepAt = (s) => (STEPS.find((x) => s < x.endS) ?? STEPS[STEPS.length - 1]).tag
const winAt = (s) => winTag(Math.min(NWIN - 1, Math.floor(s / WIN_S)))

let currentKey = null
onBeforeRequest(() => {
  const s = (Date.now() - exec.scenario.startTime) / 1000
  const step = stepAt(s)
  const win = winAt(s)
  const key = `${step}|${win}`
  if (key !== currentKey) {
    currentKey = key
    exec.vu.tags.step = step
    exec.vu.tags.win = win
  }
})

export function spike() {
  started.add(1, { step: stepAt((Date.now() - exec.scenario.startTime) / 1000) })
  t0Gauge.add(exec.scenario.startTime)
  browseFeed(THINK)
}

export function health() {
  const res = http.get(`${BASE_URL}/health`, { tags: { name: 'health' }, timeout: '10s' })
  alive.add(res.status === 200)
}

// ---- resumen ----
const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')
const maxOf = (xs) => (xs.length ? Math.max(...xs) : undefined)

function stepRow(data, s) {
  const m = data.metrics
  const reqs = values(m[`http_reqs{step:${s.tag}}`])?.count ?? 0
  const iters = values(m[`spike_iterations_started{step:${s.tag}}`])?.count ?? 0
  const lat = {}
  for (const name of USED_ENDPOINTS) {
    const v = values(m[`http_req_duration{name:${name},step:${s.tag}}`])
    lat[name] = v && v.max > 0 ? v : undefined
  }
  const maxP95 = maxOf(USED_ENDPOINTS.map((n) => lat[n]?.['p(95)']).filter((x) => x !== undefined))
  const failed = values(m[`http_req_failed{step:${s.tag}}`])?.rate
  const checks = values(m[`checks{step:${s.tag}}`])?.rate
  const checksFailed = typeof checks === 'number' ? 1 - checks : undefined
  const windowS = s.endS - s.startS
  const expected = expectedIters(s.startS, s.endS)
  return {
    s, reqs, iters, lat, maxP95, failed, checksFailed,
    errPct: Math.max(failed ?? 0, checksFailed ?? 0),
    expected,
    itPerS: iters / windowS,
    expectedItPerS: expected / windowS,
    droppedEst: Math.max(0, Math.round(expected - iters)),
    slo1: maxP95 !== undefined && maxP95 < SLO.p95Ms,
  }
}

// serie de p95 por ventana de 5 s (máximo entre endpoints)
function windowSeries(data) {
  const out = []
  for (let i = 0; i < NWIN; i++) {
    const w = winTag(i)
    const p95 = {}
    for (const name of USED_ENDPOINTS) {
      const v = values(data.metrics[`http_req_duration{name:${name},win:${w}}`])
      p95[name] = v && v.max > 0 ? v['p(95)'] : undefined
    }
    const reqs = values(data.metrics[`http_reqs{win:${w}}`])?.count ?? 0
    out.push({ win: w, start_s: i * WIN_S, end_s: (i + 1) * WIN_S, reqs, p95_feed: p95.feed, p95_detail: p95.detail, p95_max: maxOf(Object.values(p95).filter((x) => x !== undefined)) })
  }
  return out
}

// tiempo hasta recuperar: primera ventana tras el fin del pico con p95 < SLO (y primera tras la cual todas cumplen)
function recoveryTime(series) {
  const after = series.filter((w) => w.start_s >= SPIKE_END_S && w.p95_max !== undefined)
  const ok = (w) => w.p95_max < SLO.p95Ms
  const first = after.find(ok)
  let sustained
  for (let i = 0; i < after.length; i++) {
    if (after.slice(i).every(ok)) {
      sustained = after[i]
      break
    }
  }
  return { first, sustained }
}

export function handleSummary(data) {
  const rows = STEPS.map((s) => stepRow(data, s))
  const dropped = values(data.metrics.dropped_iterations)?.count ?? 0
  const t0 = values(data.metrics.spike_t0_ms)?.value
  const aliveRate = values(data.metrics.spike_alive)?.rate
  const series = windowSeries(data)
  const rec = recoveryTime(series)
  const spikeRow = rows.find((r) => r.s.tag === 'spike')
  const steady = rows.find((r) => r.s.tag === 'recovery_steady')

  const critAlive = aliveRate === 1
  const critErr = spikeRow.errPct < ERROR_LIMIT
  const critRecovery = steady.slo1
  const ttr = (w) => (w ? `${w.start_s - SPIKE_END_S} s (ventana ${w.start_s}-${w.end_s} s, p95 ${fmt(w.p95_max)} ms)` : 'no se recupera en la ventana medida')

  const iso = (s) => (typeof t0 === 'number' ? new Date(t0 + s * 1000).toISOString() : null)
  const levelsJson = {
    scenario_start_ms: t0,
    scenario_start_iso: iso(0),
    base_rate_its: BASE_RATE,
    peak_rate_its: PEAK_RATE,
    spike_end_s: SPIKE_END_S,
    spike_end_iso: iso(SPIKE_END_S),
    time_to_recovery_first_s: rec.first ? rec.first.start_s - SPIKE_END_S : null,
    time_to_recovery_sustained_s: rec.sustained ? rec.sustained.start_s - SPIKE_END_S : null,
    levels: STEPS.map((s) => ({
      step: s.tag,
      start_s: s.startS,
      end_s: s.endS,
      start_iso: iso(s.startS),
      end_iso: iso(s.endS),
    })),
  }

  const lines = [
    '# Resumen spike',
    '',
    `Modelo abierto ramping-arrival-rate, solo visitante (feed + detalle x2-3, sin login). Base ${BASE_RATE} it/s (${BASE_S} s) -> ${PEAK_RATE} it/s (x${FACTOR}) en ${RAMP_S} s, pico ${PEAK_S} s, vuelta a base en ${RAMP_S} s, recuperación ${RECOVERY_S} s (drain ${DRAIN_S} s + steady). VUs ${PRE_VUS}..${MAX_VUS}.`,
    `Duración medida: ${fmt(data.state?.testRunDurationMs / 1000, 1)} s. Pico de VUs: ${values(data.metrics.vus_max)?.max ?? 'n/d'}. dropped_iterations total: ${dropped}.`,
    '',
    '## Criterios',
    '',
    '| Criterio | Resultado | Detalle |',
    '|---|---|---|',
    `| El proceso no cae (GET /health tras la carga) | ${critAlive ? 'cumple' : 'NO cumple'} | spike_alive = ${fmt(aliveRate, 2)} |`,
    `| Error < ${ERROR_LIMIT * 100} % durante el pico | ${critErr ? 'cumple' : 'NO cumple'} | ${fmt(spikeRow.errPct * 100, 2)} % |`,
    `| SLO-1 en recovery_steady (p95 < ${SLO.p95Ms} ms por endpoint) | ${critRecovery ? 'cumple' : 'NO cumple'} | p95 máx. ${fmt(steady.maxP95)} ms |`,
    `| Tiempo hasta recuperar (informativo) | ${rec.first ? 'medido' : 'n/d'} | primera ventana < ${SLO.p95Ms} ms: ${ttr(rec.first)}; sostenida: ${ttr(rec.sustained)} |`,
    '',
    '## Por tramo',
    '',
    '| Tramo | Ventana s | it/s objetivo | it/s medidos | req/s | descartadas (estim.) | http_req_failed | checks fallidos | p95 feed | p95 detail | SLO-1 |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.s.tag} | ${r.s.startS}-${r.s.endS} | ${fmt(r.expectedItPerS, 2)} | ${fmt(r.itPerS, 2)} | ${fmt(r.reqs / (r.s.endS - r.s.startS), 1)} | ${r.droppedEst} | ${fmt((r.failed ?? NaN) * 100, 2)}% | ${fmt((r.checksFailed ?? NaN) * 100, 2)}% | ${fmt(r.lat.feed?.['p(95)'])} | ${fmt(r.lat.detail?.['p(95)'])} | ${r.slo1 ? 'cumple' : 'no cumple'} |`,
    ),
    '',
    '## Latencias por endpoint y tramo (ms)',
    '',
    '| Tramo | Endpoint | p50 | p90 | p95 | p99 |',
    '|---|---|---|---|---|---|',
    ...rows.flatMap((r) =>
      USED_ENDPOINTS.map((n) => {
        const v = r.lat[n]
        return `| ${r.s.tag} | ${n} | ${fmt(v?.['p(50)'])} | ${fmt(v?.['p(90)'])} | ${fmt(v?.['p(95)'])} | ${fmt(v?.['p(99)'])} |`
      }),
    ),
    '',
    '## p95 por ventana de 5 s (ms)',
    '',
    '| Ventana s | req | p95 feed | p95 detail |',
    '|---|---|---|---|',
    ...series.map((w) => `| ${w.start_s}-${w.end_s} | ${w.reqs} | ${fmt(w.p95_feed)} | ${fmt(w.p95_detail)} |`),
    '',
    'Descartadas (estim.) = tasa objetivo integrada sobre el tramo − iteraciones iniciadas; `dropped_iterations` no admite tag. El tramo spike incluye ambas rampas. La ventana se asigna por el inicio del request.',
    '',
  ]
  const md = lines.join('\n')
  return {
    'perf/results/spike.summary.json': JSON.stringify(data, null, 2),
    'perf/results/spike.levels.json': JSON.stringify(levelsJson, null, 2),
    'perf/results/spike.windows.json': JSON.stringify(series, null, 2),
    'perf/results/spike.slo.md': md,
    stdout: `\n${md}\n`,
  }
}
