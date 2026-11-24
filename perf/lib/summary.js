import { ENDPOINTS, SLO, SUMMARY_TREND_STATS } from './config.js'

const API_ENDPOINTS = ENDPOINTS.filter((e) => e !== 'login')

// thresholds vacíos que fuerzan a k6 a exponer el submétrico por endpoint
export function endpointSubmetrics() {
  const t = {}
  for (const name of ENDPOINTS) t[`http_req_duration{name:${name}}`] = []
  return t
}

// thresholds de SLO por endpoint (SLO-1, SLO-4) para escenarios de carga
export function sloThresholds() {
  const t = {}
  for (const name of API_ENDPOINTS) {
    t[`http_req_duration{name:${name}}`] = [`p(95)<${SLO.p95Ms}`, `p(99)<${SLO.p99Ms}`]
  }
  t.http_req_failed = [`rate<${SLO.errorRate}`]
  t.checks = [`rate>${1 - SLO.errorRate}`]
  return t
}

const values = (metric) => (metric ? (metric.values ?? metric) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')
const pct = (n) => (typeof n === 'number' ? `${(n * 100).toFixed(2)}%` : 'n/d')
const mark = (ok) => (ok ? 'cumple' : 'no cumple')

function endpointStats(data) {
  const rows = []
  for (const name of ENDPOINTS) {
    const v = values(data.metrics[`http_req_duration{name:${name}}`])
    // un submétrico sin muestras queda en 0
    if (v && (v.max ?? 0) > 0) rows.push({ name, v })
  }
  return rows
}

function counter(data, name) {
  return values(data.metrics[name])?.count ?? 0
}

export function evaluateSlo(data) {
  const stats = endpointStats(data).filter((r) => r.name !== 'login')
  const failed = values(data.metrics.http_req_failed)?.rate
  const checksRate = values(data.metrics.checks)?.rate
  const checksFailed = typeof checksRate === 'number' ? 1 - checksRate : undefined
  const maxP95 = Math.max(...stats.map((r) => r.v['p(95)'] ?? 0), 0)
  const maxP99 = Math.max(...stats.map((r) => r.v['p(99)'] ?? 0), 0)
  const total = counter(data, 'apdex_total')
  const apdex = total ? (counter(data, 'apdex_satisfied') + counter(data, 'apdex_tolerating') / 2) / total : undefined
  const matching = values(data.metrics.matching_duration)
  const hasMatching = matching && matching.count > 0

  return [
    { id: 'SLO-1', desc: `p95 por endpoint < ${SLO.p95Ms} ms (sin login)`, value: `${fmt(maxP95)} ms (peor endpoint)`, ok: stats.length > 0 && maxP95 < SLO.p95Ms },
    {
      id: 'SLO-2',
      desc: `matching_duration p95 < ${SLO.matchingP95Ms} ms`,
      value: hasMatching ? `${fmt(matching['p(95)'])} ms` : 'no medido (ningún reporte salió de pending)',
      ok: hasMatching ? matching['p(95)'] < SLO.matchingP95Ms : null,
    },
    {
      id: 'SLO-3',
      desc: `error < ${SLO.errorRate * 100}% (http_req_failed y checks)`,
      value: `http_req_failed ${pct(failed)}, checks fallidos ${pct(checksFailed)}`,
      ok: failed !== undefined && failed < SLO.errorRate && checksFailed !== undefined && checksFailed < SLO.errorRate,
    },
    { id: 'SLO-4', desc: `p99 por endpoint < ${SLO.p99Ms} ms (sin login)`, value: `${fmt(maxP99)} ms (peor endpoint)`, ok: stats.length > 0 && maxP99 < SLO.p99Ms },
    { id: 'SLO-5', desc: `Apdex (T=500 ms) >= ${SLO.apdex}`, value: apdex === undefined ? 'n/d' : fmt(apdex, 3), ok: apdex === undefined ? null : apdex >= SLO.apdex },
  ]
}

function sloTable(rows) {
  const lines = ['| SLO | Criterio | Medido | Resultado |', '|---|---|---|---|']
  for (const r of rows) lines.push(`| ${r.id} | ${r.desc} | ${r.value} | ${r.ok === null ? 'no medido' : mark(r.ok)} |`)
  return lines.join('\n')
}

function endpointTable(data) {
  const lines = ['| Endpoint | p50 | p90 | p95 | p99 | max |', '|---|---|---|---|---|---|']
  for (const { name, v } of endpointStats(data)) {
    lines.push(`| ${name} | ${fmt(v['p(50)'] ?? v.med, 1)} | ${fmt(v['p(90)'], 1)} | ${fmt(v['p(95)'], 1)} | ${fmt(v['p(99)'], 1)} | ${fmt(v.max, 1)} |`)
  }
  return lines.join('\n')
}

// recorre los grupos y junta los checks con su % OK
function collectChecks(group, out = []) {
  const checks = Array.isArray(group.checks) ? group.checks : Object.values(group.checks ?? {})
  for (const c of checks) out.push(c)
  const groups = Array.isArray(group.groups) ? group.groups : Object.values(group.groups ?? {})
  for (const g of groups) collectChecks(g, out)
  return out
}

function checksTable(data) {
  const lines = ['| Check | OK | Fallidos | % OK |', '|---|---|---|---|']
  for (const c of collectChecks(data.root_group ?? {})) {
    const total = c.passes + c.fails
    lines.push(`| ${c.name} | ${c.passes} | ${c.fails} | ${total ? ((c.passes / total) * 100).toFixed(1) : 'n/d'}% |`)
  }
  return lines.join('\n')
}

// salidas de handleSummary: JSON crudo, tabla markdown de SLO y resumen por consola
export function buildSummary(name, data) {
  const slo = evaluateSlo(data)
  const reqs = values(data.metrics.http_reqs)
  const markdown = [
    `# Resumen ${name}`,
    '',
    `Requests: ${reqs?.count ?? 'n/d'} (${fmt(reqs?.rate, 1)} req/s), duración ${fmt(data.state?.testRunDurationMs / 1000, 1)} s`,
    '',
    '## SLO',
    sloTable(slo),
    '',
    '## Latencia por endpoint (ms)',
    endpointTable(data),
    '',
    '## Checks',
    checksTable(data),
    '',
  ].join('\n')

  return {
    [`perf/results/${name}.summary.json`]: JSON.stringify(data, null, 2),
    [`perf/results/${name}.slo.md`]: markdown,
    stdout: `\n${markdown}\n`,
  }
}

export const summaryTrendStats = SUMMARY_TREND_STATS
