// muestrea CPU/memoria del backend y conexiones de Postgres a un CSV (Ctrl+C o --duration lo detiene)
// uso: node perf/scripts/sample-resources.mjs --out=perf/results/load.resources.csv [--interval=5] [--duration=SEG] [--pid-file=...] [--db-size] [--log-file=ruta] [--pids=1,2,3] [--aux-pids=PID]
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cpus } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? def

const out = resolve(root, arg('out', 'perf/results/resources.csv'))
const intervalS = Number(arg('interval', '5'))
const durationS = Number(arg('duration', '0'))
const pidFile = resolve(root, arg('pid-file', 'perf/results/backend.pid'))
const pidList = arg('pids', '').split(',').filter(Boolean).map(Number) // varias instancias: suma en backend_* y columnas inst<k>_*
const auxList = arg('aux-pids', '').split(',').filter(Boolean).map(Number) // procesos extra (ej. k6): solo columnas aux<k>_*
const dbUrl = arg('db', process.env.PERF_DATABASE_URL ?? 'postgresql://patitas:patitas@localhost:5433/patitas_perf')
const cores = cpus().length

const { Client } = createRequire(resolve(root, 'frontend', 'package.json'))('pg')
const pg = new Client({ connectionString: dbUrl })
await pg.connect()

const instPids = pidList.length ? pidList : [Number(readFileSync(pidFile, 'utf8').trim())]
const pids = [...instPids, ...auxList]

// CPU acumulada (s) y memoria del proceso + CPU total del sistema (%)
function readProcess() {
  const ids = pids.join(',')
  const script = `$s=(Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average; $o=@(${ids} | ForEach-Object { $p=Get-Process -Id $_ -ErrorAction Stop; "$($p.CPU),$($p.WorkingSet64)" }); ($o -join ';') + '|' + $s`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' })
  const [procs, sys] = r.stdout.trim().split('|')
  return { procs: procs.split(';').map((x) => x.split(',').map(Number)), sys: Number(sys) }
}

mkdirSync(dirname(out), { recursive: true })
// columnas opcionales (no cambian el CSV de los demás escenarios): --db-size y --log-file=<ruta>
const withDbSize = process.argv.includes('--db-size')
const logFile = arg('log-file', '')
const instCols = [...(pidList.length ? pidList.flatMap((_, k) => [`inst${k + 1}_cpu_pct`, `inst${k + 1}_rss_mb`]) : []), ...auxList.flatMap((_, k) => [`aux${k + 1}_cpu_pct`, `aux${k + 1}_rss_mb`])]
const extraCols = [...(withDbSize ? ['db_size_mb'] : []), ...(logFile ? ['log_size_kb'] : []), ...instCols]
writeFileSync(out, `ts,elapsed_s,backend_cpu_pct_of_core,backend_rss_mb,system_cpu_pct,pg_connections,pg_active${extraCols.map((c) => `,${c}`).join('')}\n`)

let stop = false
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (stop = true))

const t0 = Date.now()
let prev = null
while (!stop) {
  const now = Date.now()
  let row
  try {
    const p = readProcess()
    const { rows } = await pg.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE state = 'active')::int AS active FROM pg_stat_activity WHERE datname = current_database()`,
    )
    // % de un núcleo por proceso; con varias instancias backend_* es la suma
    const cpuEach = p.procs.map(([c], k) => (prev && c >= prev.cpu[k] ? ((c - prev.cpu[k]) / ((now - prev.at) / 1000)) * 100 : null))
    const cpuInst = cpuEach.slice(0, instPids.length)
    const cpuPct = cpuInst.every((x) => x !== null) ? cpuInst.reduce((a, b) => a + b, 0) : ''
    const memSum = p.procs.slice(0, instPids.length).reduce((a, [, m]) => a + m, 0)
    prev = { cpu: p.procs.map(([c]) => c), at: now }
    row = [new Date(now).toISOString(), ((now - t0) / 1000).toFixed(1), cpuPct === '' ? '' : cpuPct.toFixed(1), (memSum / 1048576).toFixed(1), p.sys, rows[0].total, rows[0].active]
    if (withDbSize) {
      const r = await pg.query('SELECT pg_database_size(current_database()) AS b')
      row.push((Number(r.rows[0].b) / 1048576).toFixed(2))
    }
    if (logFile) row.push(existsSync(resolve(root, logFile)) ? (statSync(resolve(root, logFile)).size / 1024).toFixed(1) : '')
    if (pidList.length || auxList.length) p.procs.forEach(([, m], k) => row.push(cpuEach[k] === null ? '' : cpuEach[k].toFixed(1), (m / 1048576).toFixed(1)))
  } catch (e) {
    console.error(`[sampler] ${e.message}`)
    break
  }
  appendFileSync(out, `${row.join(',')}\n`)
  if (durationS && (Date.now() - t0) / 1000 >= durationS) break
  await new Promise((r) => setTimeout(r, intervalS * 1000))
}
await pg.end()
console.log(`[sampler] listo (${cores} núcleos lógicos; backend_cpu_pct_of_core es % de un núcleo)`)
