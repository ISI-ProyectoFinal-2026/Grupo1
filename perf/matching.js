import { sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'
import { BASE_URL, SLO, SUMMARY_TREND_STATS } from './lib/config.js'
import { checkStep, get, json, post } from './lib/http.js'
import { login } from './lib/flows.js'
import { matchingDuration } from './lib/metrics.js'
import { checksTable } from './lib/summary.js'

// SLO-2 contra el Backend IA real: modelo abierto de baja tasa para no encolar la inferencia en CPU
const RATE = Number(__ENV.MATCH_RATE ?? 0.5) // creaciones por segundo
const DURATION_S = Number(__ENV.MATCH_DURATION_S ?? 300)
const TIMEOUT_S = Number(__ENV.MATCH_TIMEOUT ?? 60)
const POLL_S = Number(__ENV.MATCH_POLL_S ?? 0.5)
const PRE_VUS = Number(__ENV.MATCH_PRE_VUS ?? 10)
const MAX_VUS = Number(__ENV.MATCH_MAX_VUS ?? 80)
const IMAGE_BASE = __ENV.MATCH_IMAGE_BASE ?? 'http://localhost:8780/pets'
const IMAGES = (__ENV.MATCH_IMAGES ?? 'dog.jpg').split(',')
const OUTCOMES = ['published', 'rejected', 'timeout']

// desde el fin del POST (matching_duration, ms) y desde el inicio del request (ms)
const matchingTotal = new Trend('matching_duration_total', true)
const matchesAfterPublish = new Trend('matches_after_publish', true)
const createFailed = new Counter('matching_create_failed')

const submetrics = {}
for (const o of OUTCOMES) {
  submetrics[`matching_duration{outcome:${o}}`] = []
  submetrics[`matching_duration_total{outcome:${o}}`] = []
}
submetrics['matching_duration{outcome:published}'] = [`p(95)<${SLO.matchingP95Ms}`]

export const options = {
  scenarios: {
    matching: {
      executor: 'constant-arrival-rate',
      rate: Math.round(RATE * 100),
      timeUnit: '100s',
      duration: `${DURATION_S}s`,
      preAllocatedVUs: PRE_VUS,
      maxVUs: MAX_VUS,
      gracefulStop: `${Math.ceil(TIMEOUT_S + 15)}s`,
    },
  },
  summaryTrendStats: [...SUMMARY_TREND_STATS, 'count'],
  thresholds: {
    ...submetrics,
    http_req_failed: [`rate<${SLO.errorRate}`],
  },
}

export default function () {
  const token = login()
  if (!token) return
  const image = IMAGES[(__ITER + __VU) % IMAGES.length]
  const body = {
    reportType: Math.random() < 0.5 ? 'lost' : 'found',
    title: `Matching VU${__VU} iter${__ITER}`,
    description: 'Reporte creado por k6 (SLO-2)',
    imageUrl: `${IMAGE_BASE}/${image}?v=${__VU}-${__ITER}`,
    location: { lat: -34.6 + Math.random() * 0.1, lng: -58.4 + Math.random() * 0.1 },
  }
  const startedAt = Date.now()
  const created = post('create', '/api/reports', body, token)
  const ok = checkStep(created, 'create', 201, (b) => Number.isInteger(b.id) && typeof b.status === 'string')
  if (!ok) {
    createFailed.add(1)
    return
  }
  const id = json(created).id
  const postDoneAt = Date.now()

  // polling hasta que salga de pending (published o rejected) o venza el timeout
  let outcome = 'timeout'
  let doneAt = postDoneAt
  while ((Date.now() - postDoneAt) / 1000 < TIMEOUT_S) {
    sleep(POLL_S)
    const res = get('poll', `/api/reports/${id}`, token)
    checkStep(res, 'poll', 200, (b) => b.id === id)
    const status = json(res)?.status
    doneAt = Date.now()
    if (status && status !== 'pending') {
      outcome = status === 'published' ? 'published' : status
      break
    }
  }
  const tags = { outcome }
  matchingDuration.add(doneAt - postDoneAt, tags)
  matchingTotal.add(doneAt - startedAt, tags)

  if (outcome === 'published') {
    const m = get('matches', `/api/reports/${id}/matches`, token)
    checkStep(m, 'matches', 200, (b) => Array.isArray(b))
    matchesAfterPublish.add(m.timings.duration)
  }
}

const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(0) : 'n/d')

function row(label, v) {
  if (!v || !v.count) return `| ${label} | 0 | n/d | n/d | n/d | n/d | n/d |`
  return `| ${label} | ${v.count} | ${fmt(v['p(50)'])} | ${fmt(v['p(90)'])} | ${fmt(v['p(95)'])} | ${fmt(v['p(99)'])} | ${fmt(v.max)} |`
}

export function handleSummary(data) {
  const byOutcome = (name, o) => values(data.metrics[`${name}{outcome:${o}}`])
  const published = byOutcome('matching_duration', 'published')
  const measured = !!published?.count
  const p95 = published?.['p(95)']
  const failed = values(data.metrics.http_req_failed)?.rate
  const lines = ['| Métrica (ms) | n | p50 | p90 | p95 | p99 | max |', '|---|---|---|---|---|---|---|']
  for (const o of OUTCOMES) lines.push(row(`matching_duration ${o}`, byOutcome('matching_duration', o)))
  for (const o of OUTCOMES) lines.push(row(`matching_duration_total ${o}`, byOutcome('matching_duration_total', o)))
  lines.push(row('matches_after_publish', values(data.metrics.matches_after_publish)))

  const markdown = [
    '# Resumen matching (SLO-2)',
    '',
    `Parámetros: tasa ${RATE} it/s, ${DURATION_S} s, timeout ${TIMEOUT_S} s, polling ${POLL_S} s, imágenes ${IMAGES.join(',')}`,
    `Evento "matching terminado": el reporte sale de pending (published o rejected). Base: ${BASE_URL}`,
    '',
    '## SLO-2',
    `matching_duration p95 (solo published) < ${SLO.matchingP95Ms} ms: ${measured ? `${fmt(p95)} ms, ${p95 < SLO.matchingP95Ms ? 'cumple' : 'no cumple'}` : 'no medido'}`,
    `Creaciones fallidas: ${values(data.metrics.matching_create_failed)?.count ?? 0}; http_req_failed: ${typeof failed === 'number' ? `${(failed * 100).toFixed(2)}%` : 'n/d'}`,
    '',
    '## Latencias',
    ...lines,
    '',
    '## Checks',
    checksTable(data),
    '',
  ].join('\n')

  return {
    'perf/results/matching.summary.json': JSON.stringify(data, null, 2),
    'perf/results/matching.slo.md': markdown,
    stdout: `\n${markdown}\n`,
  }
}
