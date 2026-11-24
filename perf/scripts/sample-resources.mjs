// muestrea CPU/memoria del backend y conexiones de Postgres a un CSV (Ctrl+C o --duration lo detiene)
// uso: node perf/scripts/sample-resources.mjs --out=perf/results/load.resources.csv [--interval=5] [--duration=SEG] [--pid-file=...] [--db-size] [--log-file=ruta]
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
const dbUrl = arg('db', process.env.PERF_DATABASE_URL ?? 'postgresql://patitas:patitas@localhost:5433/patitas_perf')
const cores = cpus().length

const { Client } = createRequire(resolve(root, 'frontend', 'package.json'))('pg')
const pg = new Client({ connectionString: dbUrl })
await pg.connect()

const pid = Number(readFileSync(pidFile, 'utf8').trim())

// CPU acumulada (s) y memoria del proceso + CPU total del sistema (%)
function readProcess() {
  const script = `$p=Get-Process -Id ${pid} -ErrorAction Stop; $s=(Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average; "$($p.CPU),$($p.WorkingSet64),$s"`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' })
  const [cpu, mem, sys] = r.stdout.trim().split(',').map(Number)
  return { cpu, mem, sys }
}

mkdirSync(dirname(out), { recursive: true })
// columnas opcionales (no cambian el CSV de los demás escenarios): --db-size y --log-file=<ruta>
const withDbSize = process.argv.includes('--db-size')
const logFile = arg('log-file', '')
const extraCols = [...(withDbSize ? ['db_size_mb'] : []), ...(logFile ? ['log_size_kb'] : [])]
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
    const cpuPct = prev && p.cpu >= prev.cpu ? ((p.cpu - prev.cpu) / ((now - prev.at) / 1000)) * 100 : ''
    prev = { cpu: p.cpu, at: now }
    row = [new Date(now).toISOString(), ((now - t0) / 1000).toFixed(1), cpuPct === '' ? '' : cpuPct.toFixed(1), (p.mem / 1048576).toFixed(1), p.sys, rows[0].total, rows[0].active]
    if (withDbSize) {
      const r = await pg.query('SELECT pg_database_size(current_database()) AS b')
      row.push((Number(r.rows[0].b) / 1048576).toFixed(2))
    }
    if (logFile) row.push(existsSync(resolve(root, logFile)) ? (statSync(resolve(root, logFile)).size / 1024).toFixed(1) : '')
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
