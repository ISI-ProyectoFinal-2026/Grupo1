import { sleep } from 'k6'
import { SLO, SUMMARY_TREND_STATS } from './lib/config.js'
import { checkStep, get } from './lib/http.js'
import { login } from './lib/flows.js'
import { checksTable } from './lib/summary.js'

// N usuarios con la campana abierta: cada uno consulta el contador cada 30 s (#338)
const SCALE = Number(__ENV.PERF_SCALE ?? 1)
const VUS = Number(__ENV.POLLING_VUS ?? 200)
const POLL_S = Number(__ENV.POLLING_INTERVAL_S ?? 30)
const s = (seconds) => `${Math.max(1, Math.round(seconds * SCALE))}s`

export const options = {
  scenarios: {
    polling: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: s(60), target: VUS },
        { duration: s(300), target: VUS },
        { duration: s(30), target: 0 },
      ],
      gracefulRampDown: `${POLL_S}s`,
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  // SLO-1 y SLO-3 sobre el endpoint de polling (el login queda afuera)
  thresholds: {
    'http_req_duration{name:unread_count}': [`p(95)<${SLO.p95Ms}`],
    'http_req_failed{name:unread_count}': [`rate<${SLO.errorRate}`],
    checks: [`rate>${1 - SLO.errorRate}`],
    'http_reqs{name:unread_count}': [],
  },
}

// un login por VU, como una sesión abierta
let token = null

export default function () {
  if (!token) {
    token = login()
    if (!token) return
    // las pestañas no arrancan sincronizadas
    sleep(Math.random() * POLL_S)
  }
  const started = Date.now()
  const res = get('unread_count', '/api/notifications/unread-count', token)
  checkStep(res, 'unread_count', 200, (b) => Number.isInteger(b.count) && b.count >= 0)
  sleep(Math.max(0, POLL_S - (Date.now() - started) / 1000))
}

const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')

export function handleSummary(data) {
  const d = values(data.metrics['http_req_duration{name:unread_count}'])
  const failed = values(data.metrics['http_req_failed{name:unread_count}'])?.rate
  const p95 = d?.['p(95)']
  const p95Ok = typeof p95 === 'number' && p95 < SLO.p95Ms
  const errorOk = typeof failed === 'number' && failed < SLO.errorRate
  const md = [
    '# Resumen notifications-polling',
    '',
    `Modelo cerrado ramping-vus: ${VUS} usuarios, un GET /api/notifications/unread-count cada ${POLL_S} s por usuario. Rampa ${s(60)}, meseta ${s(300)}, bajada ${s(30)}.`,
    `Duración: ${fmt(data.state?.testRunDurationMs / 1000, 1)} s. Pico de VUs: ${values(data.metrics.vus_max)?.max ?? 'n/d'}.`,
    '',
    '## Umbral',
    '',
    '| SLO | Objetivo | Valor | Cumple |',
    '|---|---|---|---|',
    `| SLO-1 (p95 unread_count) | < ${SLO.p95Ms} ms | ${fmt(p95, 1)} ms | ${p95Ok ? 'sí' : 'no'} |`,
    `| SLO-3 (error unread_count) | < ${SLO.errorRate * 100} % | ${fmt((failed ?? NaN) * 100, 2)} % | ${errorOk ? 'sí' : 'no'} |`,
    '',
    '## unread_count',
    '',
    '| p50 (ms) | p95 (ms) | p99 (ms) | requests |',
    '|---|---|---|---|',
    `| ${fmt(d?.['p(50)'] ?? d?.med, 1)} | ${fmt(p95, 1)} | ${fmt(d?.['p(99)'], 1)} | ${values(data.metrics['http_reqs{name:unread_count}'])?.count ?? 'n/d'} |`,
    '',
    '## Checks',
    checksTable(data),
    '',
  ].join('\n')
  return {
    'perf/results/notifications-polling.summary.json': JSON.stringify(data, null, 2),
    'perf/results/notifications-polling.slo.md': md,
    stdout: `\n${md}\n`,
  }
}
