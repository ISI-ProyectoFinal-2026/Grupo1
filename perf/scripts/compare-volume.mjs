// compara volume.1x y volume.10x: node perf/scripts/compare-volume.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DIR = resolve(import.meta.dirname, '../results')
const SLO_P95_MS = 500
const NAMES = ['feed', 'detail', 'mine', 'notifications']
const LABELS = ['1x', '10x']

const values = (m) => (m ? (m.values ?? m) : undefined)
const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')
const load = (label) => JSON.parse(readFileSync(resolve(DIR, `volume.${label}.summary.json`), 'utf8'))

function extract(data) {
  const out = {}
  for (const n of NAMES) {
    const d = values(data.metrics[`http_req_duration{name:${n},step:measure}`])
    if (!d || !(d.max > 0)) continue
    const b = values(data.metrics[`${n}_body_bytes`])
    out[n] = {
      p95Ms: d['p(95)'],
      errorPct: (values(data.metrics[`http_req_failed{name:${n},step:measure}`])?.rate ?? NaN) * 100,
      bodyBytes: b?.count ? b.avg : undefined,
    }
  }
  const worst = Math.max(...Object.values(out).map((e) => e.p95Ms), 0)
  return {
    endpoints: out,
    worstP95Ms: worst,
    slo1: Object.keys(out).length > 0 && worst < SLO_P95_MS,
    errorPct: (values(data.metrics['http_req_failed{step:measure}'])?.rate ?? NaN) * 100,
  }
}

const res = Object.fromEntries(LABELS.map((l) => [l, extract(load(l))]))
const names = NAMES.filter((n) => LABELS.some((l) => res[l].endpoints[n]))
const ratio = (a, b) => (typeof a === 'number' && typeof b === 'number' && a > 0 ? `x${(b / a).toFixed(2)}` : 'n/d')
const e = (l, n) => res[l].endpoints[n]
const slo = (ok) => (ok ? 'cumple' : 'no cumple')

const md = [
  '# Comparación de volumen 1x vs 10x',
  '',
  '1x = 1000 reportes / 2000 usuarios; 10x = 10000 reportes / 2000 usuarios (supuesto del equipo).',
  '',
  '| Endpoint | p95 1x (ms) | p95 10x (ms) | Variación p95 | Error 1x | Error 10x | Body 1x (bytes) | Body 10x (bytes) | Variación body | SLO-1 10x |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...names.map(
    (n) =>
      `| ${n} | ${fmt(e('1x', n)?.p95Ms, 1)} | ${fmt(e('10x', n)?.p95Ms, 1)} | ${ratio(e('1x', n)?.p95Ms, e('10x', n)?.p95Ms)} | ${fmt(e('1x', n)?.errorPct, 2)}% | ${fmt(e('10x', n)?.errorPct, 2)}% | ${fmt(e('1x', n)?.bodyBytes)} | ${fmt(e('10x', n)?.bodyBytes)} | ${ratio(e('1x', n)?.bodyBytes, e('10x', n)?.bodyBytes)} | ${e('10x', n) ? slo(e('10x', n).p95Ms < SLO_P95_MS) : 'n/d'} |`,
  ),
  '',
  `Peor p95: ${fmt(res['1x'].worstP95Ms, 1)} ms (1x) vs ${fmt(res['10x'].worstP95Ms, 1)} ms (10x). Error global: ${fmt(res['1x'].errorPct, 2)}% vs ${fmt(res['10x'].errorPct, 2)}%.`,
  '',
  `**Criterio (SLO-1, p95 < ${SLO_P95_MS} ms por endpoint, sin login) a 10x: ${slo(res['10x'].slo1)}.** A 1x: ${slo(res['1x'].slo1)}.`,
  '',
].join('\n')

const chart = {
  sloP95Ms: SLO_P95_MS,
  labels: LABELS,
  endpoints: names,
  series: {
    p95Ms: Object.fromEntries(LABELS.map((l) => [l, names.map((n) => e(l, n)?.p95Ms ?? null)])),
    errorPct: Object.fromEntries(LABELS.map((l) => [l, names.map((n) => e(l, n)?.errorPct ?? null)])),
    bodyBytes: Object.fromEntries(LABELS.map((l) => [l, names.map((n) => e(l, n)?.bodyBytes ?? null)])),
  },
  slo1: { '1x': res['1x'].slo1, '10x': res['10x'].slo1 },
}

writeFileSync(resolve(DIR, 'volume.compare.md'), md)
writeFileSync(resolve(DIR, 'volume.compare.json'), JSON.stringify(chart, null, 2))
console.log(md)
