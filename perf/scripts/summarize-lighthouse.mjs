// resume los LHR de perf/results/lighthouse/<mobile|desktop> en summary.json y summary.md
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'results', 'lighthouse')
const median = (a) => {
  const s = a.filter((x) => x != null).sort((x, y) => x - y)
  if (!s.length) return null
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const rows = []
for (const mode of ['mobile', 'desktop']) {
  const dir = resolve(base, mode)
  if (!existsSync(dir)) continue
  const byRoute = new Map()
  for (const f of readdirSync(dir).filter((n) => /\.report\.json$/.test(n))) {
    const lhr = JSON.parse(readFileSync(resolve(dir, f), 'utf8'))
    const path = new URL(lhr.finalDisplayedUrl ?? lhr.finalUrl).pathname.replace(/\/\d+$/, '/:id')
    if (!byRoute.has(path)) byRoute.set(path, [])
    byRoute.get(path).push(lhr)
  }
  for (const [route, runs] of byRoute) {
    const a = (id) => runs.map((l) => l.audits[id]?.numericValue)
    const js = runs.map((l) => l.audits['network-requests']?.details?.items?.filter((i) => i.resourceType === 'Script').length)
    const failedA11y = new Map()
    for (const l of runs) {
      for (const ref of l.categories.accessibility.auditRefs) {
        const au = l.audits[ref.id]
        if (au.score === 0 && au.scoreDisplayMode === 'binary') failedA11y.set(ref.id, (au.details?.items?.length ?? 0))
      }
    }
    rows.push({
      formFactor: mode,
      route,
      runs: runs.length,
      performance: median(runs.map((l) => l.categories.performance.score)),
      accessibility: median(runs.map((l) => l.categories.accessibility.score)),
      fcpMs: median(a('first-contentful-paint')),
      lcpMs: median(a('largest-contentful-paint')),
      tbtMs: median(a('total-blocking-time')),
      cls: median(a('cumulative-layout-shift')),
      interactiveMs: median(a('interactive')),
      totalByteWeight: median(a('total-byte-weight')),
      jsRequests: median(js),
      failedA11yAudits: Object.fromEntries(failedA11y),
    })
  }
}
writeFileSync(resolve(base, 'summary.json'), JSON.stringify(rows, null, 2))
const f = (v, d = 0) => (v == null ? 's/d' : v.toFixed(d))
const md = [
  '| Form factor | Ruta | Runs | Perf | A11y | FCP ms | LCP ms | TBT ms | CLS | TTI ms | Peso KiB | JS req |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.formFactor} | ${r.route} | ${r.runs} | ${f(r.performance * 100)} | ${f(r.accessibility * 100)} | ${f(r.fcpMs)} | ${f(r.lcpMs)} | ${f(r.tbtMs)} | ${f(r.cls, 3)} | ${f(r.interactiveMs)} | ${f(r.totalByteWeight / 1024, 1)} | ${f(r.jsRequests)} |`),
  '',
  'Puntajes en escala 0-100 (mediana de las corridas). Auditorías de accesibilidad fallidas (ítems afectados, última corrida de cada ruta):',
  ...rows.map((r) => `- ${r.formFactor} ${r.route}: ${Object.entries(r.failedA11yAudits).map(([k, v]) => `${k} (${v})`).join(', ') || 'ninguna'}`),
  '',
]
writeFileSync(resolve(base, 'summary.md'), md.join('\n'))
console.log(md.join('\n'))
