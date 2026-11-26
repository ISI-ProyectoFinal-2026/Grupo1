// compara scalability.{1,2,4}cpu: node perf/scripts/compare-scalability.mjs [--n=1,2,4] [--dir=subcarpeta de perf/results]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DIR = resolve(import.meta.dirname, '../results', process.argv.find((x) => x.startsWith('--dir='))?.slice(6) ?? '')
const NS = (process.argv.find((a) => a.startsWith('--n='))?.slice(4) ?? '1,2,4').split(',').map(Number)
const CRITERION = 1.6 // x2 instancias => >= x1,6 de capacidad
const WARM_S = 6 // se descarta el inicio del escalón (rampa + primer muestreo)

const fmt = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : 'n/d')
const json = (f) => JSON.parse(readFileSync(resolve(DIR, f), 'utf8'))
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

function readCsv(file) {
  if (!existsSync(file)) return []
  const [head, ...lines] = readFileSync(file, 'utf8').trim().split(/\r?\n/)
  const cols = head.split(',')
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v === '' ? NaN : i === 0 ? Date.parse(v) : Number(v)])))
}

// medias de recursos dentro de un escalón
function resourcesAt(csv, meta, steps, row) {
  if (!row) return null
  const from = meta.startMs + row.i * steps.windowS * 1000 + WARM_S * 1000
  const to = meta.startMs + (row.i + 1) * steps.windowS * 1000
  const w = csv.filter((r) => r.ts >= from && r.ts <= to)
  const col = (c) => mean(w.map((r) => r[c]).filter(Number.isFinite))
  return {
    samples: w.length,
    instCpuPct: meta.pids.map((_, k) => col(`inst${k + 1}_cpu_pct`)),
    k6CpuPct: col('aux1_cpu_pct'),
    proxyCpuPct: col('aux2_cpu_pct'),
    systemCpuPct: col('system_cpu_pct'),
    pgConnectionsMax: Math.max(...w.map((r) => r.pg_connections).filter(Number.isFinite)),
    pgActiveMean: col('pg_active'),
  }
}

const runs = NS.map((n) => {
  const steps = json(`scalability.${n}cpu.steps.json`)
  const meta = json(`scalability.${n}cpu.meta.json`)
  const csv = readCsv(resolve(DIR, `scalability.${n}cpu.resources.csv`))
  const cap = steps.capacity
  const fail = steps.firstFail
  return { n, steps, meta, cap, fail, capRes: resourcesAt(csv, meta, steps, cap), failRes: resourcesAt(csv, meta, steps, fail), pgMax: Math.max(...csv.map((r) => r.pg_connections).filter(Number.isFinite)) }
})

const base = runs[0]
const ratio = (a, b) => (typeof a === 'number' && typeof b === 'number' && a > 0 ? b / a : NaN)
const verdict = (x) => (Number.isFinite(x) ? (x >= CRITERION ? 'cumple' : 'no cumple') : 'n/d')

// capacidad medida (it/s iniciados) y rango por resolución del paso: [último que cumple, primero que falla)
const capIt = (r) => r.cap?.itPerS
const consecutive = runs.slice(1).map((r, i) => {
  const prev = runs[i]
  const x = ratio(capIt(prev), capIt(r))
  return { from: prev.n, to: r.n, ratio: x, min: ratio(prev.fail?.rate, r.cap?.rate), max: ratio(prev.cap?.rate, r.fail?.rate), verdict: verdict(x) }
})

const lines = [
  '# Escalabilidad C: 1, 2 y 4 instancias del backend',
  '',
  `Capacidad = último escalón (desde el inicio) que cumple SLO-1 (p95 < 500 ms por endpoint), error < 1 % y entrega >= ${base.steps.deliveredMin * 100} % de la tasa objetivo. Solo flujo visitante (feed + detalle). Cada instancia fija a un hilo lógico propio; pool Prisma \`connection_limit=${base.meta.connectionLimitPerInstance}\` por instancia.`,
  '',
  '## Capacidad',
  '',
  '| Instancias | Capacidad (it/s objetivo) | it/s medidos | req/s | Primer escalón que falla (it/s) | Ratio vs 1 instancia | Conexiones pg (máx. corrida) |',
  '|---|---|---|---|---|---|---|',
  ...runs.map((r) => `| ${r.n} | ${r.cap ? r.cap.rate : `< ${r.steps.startRate} (no cumple ni el primero)`} | ${fmt(r.cap?.itPerS, 2)} | ${fmt(r.cap?.reqPerS, 1)} | ${r.fail ? `${r.fail.rate} (${fmt(r.fail.itPerS, 2)} medidos)` : 'ninguno'} | x${fmt(ratio(capIt(base), capIt(r)), 2)} | ${r.pgMax} |`),
  '',
  `## Criterio: duplicar instancias => >= x${CRITERION} de capacidad`,
  '',
  '| Paso | Ratio (it/s medidos) | Rango por resolución del escalón | Veredicto |',
  '|---|---|---|---|',
  ...consecutive.map((c) => `| ${c.from} -> ${c.to} | x${fmt(c.ratio, 2)} | x${fmt(c.min, 2)} a x${fmt(c.max, 2)} | ${c.verdict} |`),
  '',
  'El rango compara (capacidad de la configuración mayor / primer fallo de la menor) con (primer fallo de la mayor / capacidad de la menor): la capacidad real de cada una está entre su último escalón que cumple y el primero que falla.',
  '',
  '## Recursos en el escalón de capacidad y en el primero que falla (media del escalón)',
  '',
  '| Instancias | Escalón | CPU por instancia (% de un núcleo) | CPU de k6 (% de un núcleo) | CPU del proxy (% de un núcleo) | CPU total del sistema (%) | pg activas (media) | pg conexiones (máx.) |',
  '|---|---|---|---|---|---|---|---|',
  ...runs.flatMap((r) =>
    [
      ['capacidad', r.cap, r.capRes],
      ['primer fallo', r.fail, r.failRes],
    ]
      .filter(([, s, x]) => s && x)
      .map(([name, s, x]) => `| ${r.n} | ${name} (${s.rate} it/s) | ${x.instCpuPct.map((v) => fmt(v, 0)).join(' / ')} | ${fmt(x.k6CpuPct, 0)} | ${fmt(x.proxyCpuPct, 0)} | ${fmt(x.systemCpuPct, 0)} | ${fmt(x.pgActiveMean, 1)} | ${fmt(x.pgConnectionsMax)} |`),
  ),
  '',
  '## Curvas por escalón (p95 máximo feed/detail, ms)',
  '',
  '| Instancias | it/s objetivo: p95 máx. (ms) |',
  '|---|---|',
  ...runs.map((r) => `| ${r.n} | ${r.steps.rows.map((s) => `${s.rate}: ${fmt(s.maxP95)}${s.ok ? '' : '*'}`).join(' ; ')} |`),
  '',
  '`*` = el escalón no cumple. Cada configuración usa su propia grilla de tasas (ver detalle en `scalability.<N>cpu.slo.md`).',
  '',
].join('\n')

const chart = {
  criterion: CRITERION,
  sloP95Ms: 500,
  instances: runs.map((r) => r.n),
  capacityItPerS: runs.map((r) => r.cap?.itPerS ?? null),
  capacityTargetItPerS: runs.map((r) => r.cap?.rate ?? null),
  capacityReqPerS: runs.map((r) => r.cap?.reqPerS ?? null),
  firstFailItPerS: runs.map((r) => r.fail?.rate ?? null),
  ratioVs1: runs.map((r) => ratio(capIt(base), capIt(r)) || null),
  consecutive,
  cpuAtCapacity: runs.map((r) => ({ instances: r.n, instCpuPct: r.capRes?.instCpuPct ?? null, k6CpuPct: r.capRes?.k6CpuPct ?? null, proxyCpuPct: r.capRes?.proxyCpuPct ?? null, systemCpuPct: r.capRes?.systemCpuPct ?? null })),
  cpuAtFirstFail: runs.map((r) => ({ instances: r.n, instCpuPct: r.failRes?.instCpuPct ?? null, k6CpuPct: r.failRes?.k6CpuPct ?? null, proxyCpuPct: r.failRes?.proxyCpuPct ?? null, systemCpuPct: r.failRes?.systemCpuPct ?? null })),
  connectionLimitPerInstance: base.meta.connectionLimitPerInstance,
  curves: Object.fromEntries(runs.map((r) => [r.n, r.steps.rows.map((s) => ({ targetItPerS: s.rate, itPerS: s.itPerS, reqPerS: s.reqPerS, p95FeedMs: s.p95.feed ?? null, p95DetailMs: s.p95.detail ?? null, errorPct: (s.failed ?? 0) * 100, ok: s.ok }))])),
}

writeFileSync(resolve(DIR, 'scalability.compare.md'), lines)
writeFileSync(resolve(DIR, 'scalability.compare.json'), JSON.stringify(chart, null, 2))
console.log(lines)
