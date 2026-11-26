// analiza tendencias de recursos del soak (regresión lineal sobre la fase estable)
// uso: node perf/scripts/analyze-soak.mjs [--resources=perf/results/soak.resources.csv] [--out=perf/results/soak.out.txt] [--meta=perf/results/soak.meta.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? def
const read = (p) => readFileSync(resolve(root, p), 'utf8')

const meta = JSON.parse(read(arg('meta', 'perf/results/soak.meta.json')))
const startMs = Number(/SOAK_START_MS=(\d+)/.exec(read(arg('out', 'perf/results/soak.out.txt')))?.[1])
if (!Number.isFinite(startMs)) throw new Error('no se encontró SOAK_START_MS en la salida de k6')

// umbral de crecimiento sostenido: proyección sobre la fase estable > 10 % de la media del primer tercio
// (mismo 10 % que el criterio de p95) y por encima de un piso absoluto, con |t| > 3 en la pendiente
const REL_LIMIT = 0.1
const T_MIN = 3

const [header, ...lines] = read(arg('resources', 'perf/results/soak.resources.csv')).trim().split(/\r?\n/)
const cols = header.split(',')
const rows = lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v === '' ? NaN : Number.isNaN(Number(v)) ? v : Number(v)])))
for (const r of rows) r.t = (Date.parse(r.ts) - startMs) / 1000

const steady = rows.filter((r) => r.t >= meta.rampS && r.t < meta.rampS + meta.steadyS)
const third = (i) => steady.filter((r) => r.t >= meta.rampS + i * meta.thirdS && r.t < meta.rampS + (i + 1) * meta.thirdS)
const thirds = [0, 1, 2].map(third)
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN)

// mínimos cuadrados: pendiente por minuto y estadístico t
function regress(rs, key) {
  const pts = rs.filter((r) => Number.isFinite(r[key])).map((r) => [r.t / 60, r[key]])
  const n = pts.length
  if (n < 5) return { n, slope: NaN, t: NaN }
  const mx = mean(pts.map((p) => p[0]))
  const my = mean(pts.map((p) => p[1]))
  const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0)
  const sxy = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0)
  const slope = sxy / sxx
  const sse = pts.reduce((a, p) => a + (p[1] - (my + slope * (p[0] - mx))) ** 2, 0)
  const se = Math.sqrt(sse / (n - 2) / sxx)
  return { n, slope, t: se > 0 ? slope / se : slope === 0 ? 0 : Infinity }
}

const steadyMin = meta.steadyS / 60
const METRICS = [
  { key: 'backend_rss_mb', label: 'RSS del backend', unit: 'MB', floor: 10, verdict: true },
  { key: 'pg_connections', label: 'Conexiones de Postgres', unit: 'conexiones', floor: 2, verdict: true },
  { key: 'backend_cpu_pct_of_core', label: 'CPU del backend', unit: '% de un núcleo', floor: 0, verdict: false },
  { key: 'db_size_mb', label: 'Tamaño de la base perf', unit: 'MB', floor: 0, verdict: false },
  { key: 'log_size_kb', label: 'Tamaño del log del backend', unit: 'KB', floor: 0, verdict: false },
].filter((m) => rows.some((r) => Number.isFinite(r[m.key])))

const out = METRICS.map((m) => {
  const reg = regress(steady, m.key)
  const means = thirds.map((rs) => mean(rs.map((r) => r[m.key]).filter(Number.isFinite)))
  const projected = reg.slope * steadyMin
  const rel = projected / means[0]
  const growthAll = projected > Math.max(REL_LIMIT * means[0], m.floor) && reg.t > T_MIN
  // segunda mitad (t2+t3): distingue un escalón que se estabiliza de un crecimiento que continúa
  const reg2 = regress([...thirds[1], ...thirds[2]], m.key)
  const projected2 = reg2.slope * (2 * meta.thirdS / 60)
  const growth2 = projected2 > Math.max(REL_LIMIT * means[1], m.floor) && reg2.t > T_MIN
  const growth = growthAll && growth2
  return { ...m, ...reg, means, projected, rel, growthAll, growth2, slope2: reg2.slope, t2: reg2.t, projected2, growth, max: Math.max(...steady.map((r) => r[m.key]).filter(Number.isFinite)) }
})

const f = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : 'n/d')
const md = [
  '# Análisis de recursos del soak',
  '',
  `Fase estable: ${f(steadyMin, 1)} min (${steady.length} muestras de ${rows.length}), tercios de ${f(meta.thirdS / 60, 2)} min. Muestreo alineado con el arranque de k6 (\`SOAK_START_MS\`).`,
  '',
  `Criterio de crecimiento sostenido (RSS y conexiones), debe cumplirse en toda la fase estable **y** en su segunda mitad (t2+t3, umbral sobre la media de t2): pendiente de mínimos cuadrados con |t| > ${T_MIN} **y** crecimiento proyectado sobre la fase estable (pendiente x ${f(steadyMin, 1)} min) mayor que ${REL_LIMIT * 100} % de la media del primer tercio (el mismo 10 % del criterio de p95) y mayor que un piso absoluto de ruido (10 MB de RSS, 2 conexiones). Las muestras consecutivas están autocorrelacionadas, por lo que el t es optimista; el piso absoluto y el 10 % evitan falsos positivos. CPU, base y log son informativos: sin veredicto.`,
  '',
  '| Métrica | Pendiente /min | t | Proyectado en fase estable | Pendiente t2+t3 /min | t (t2+t3) | Media t1 | Media t2 | Media t3 | Máx | Crecimiento sostenido |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  ...out.map(
    (m) =>
      `| ${m.label} (${m.unit}) | ${f(m.slope, 4)} | ${f(m.t, 1)} | ${f(m.projected)} (${f(m.rel * 100, 1)} %) | ${f(m.slope2, 4)} | ${f(m.t2, 1)} | ${m.means.map((x) => f(x)).join(' | ')} | ${f(m.max)} | ${m.verdict ? (m.growth ? 'SÍ' : m.growthAll ? 'no (escalón que se estabiliza)' : 'no') : 'informativo'} |`,
  ),
  '',
].join('\n')

writeFileSync(resolve(root, 'perf/results/soak.analysis.md'), md)
writeFileSync(
  resolve(root, 'perf/results/soak.analysis.json'),
  JSON.stringify({ steadyMin, samples: steady.length, relLimit: REL_LIMIT, tMin: T_MIN, metrics: out }, null, 2),
)
console.log(md)
