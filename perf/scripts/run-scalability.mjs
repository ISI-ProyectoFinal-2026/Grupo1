// escalabilidad C: para cada N levanta N instancias del backend (1 núcleo c/u) + nginx, corre k6 y lo desmonta
// uso: node perf/scripts/run-scalability.mjs [--n=1,2,4] [--plan=N:inicio:paso:escalones,...] [--step-s=45] [--conn-limit=10] [--no-seed]
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? def
const results = resolve(root, 'perf', 'results')
mkdirSync(results, { recursive: true })

const NS = arg('n', '1,2,4').split(',').map(Number)
const STEP_S = Number(arg('step-s', '45'))
const CONN_LIMIT = Number(arg('conn-limit', '10')) // pool de Prisma por instancia (igual en todas las configs)
const BALANCER = arg('balancer', 'node') // node (proxy.mjs) o nginx (contenedor)
const PROXY_CORE = 6 // el proxy de Node va fijo a un hilo propio
const DIRECT = process.argv.includes('--direct') // diagnóstico: k6 contra la instancia 1, sin nginx
const SEED = !process.argv.includes('--no-seed')
const BASE_PORT = 3001
const LB_PORT = 8080
const LB_NAME = 'perf-scalability-lb'
const AI_PORT = process.env.AI_STUB_PORT ?? '8765'
// núcleos lógicos de las instancias: 4 físicos / 8 lógicos; se usa un hilo por núcleo físico (impares) y se evita el 0
const BACKEND_CORES = [1, 3, 5, 7]
const K6_CORES = BALANCER === 'node' ? [0, 2, 4] : [0, 2, 4, 6] // el hilo 6 es del proxy de Node
const mask = (cores) => cores.reduce((a, c) => a + 2 ** c, 0)

// plan por N: inicio, paso y cantidad de escalones
const plan = Object.fromEntries(
  arg('plan', '')
    .split(',')
    .filter(Boolean)
    .map((p) => {
      const [n, start, step, steps] = p.split(':').map(Number)
      return [n, { start, step, steps }]
    }),
)

const dbBase = process.env.PERF_DATABASE_URL ?? 'postgresql://patitas:patitas@localhost:5433/patitas_perf'
if (!/perf/i.test(new URL(dbBase).pathname)) throw new Error('DATABASE_URL no parece de performance')
const dbUrl = `${dbBase}${dbBase.includes('?') ? '&' : '?'}connection_limit=${CONN_LIMIT}`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ps = (script) => spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' })
const setAffinity = (pid, cores) => ps(`(Get-Process -Id ${pid}).ProcessorAffinity = [IntPtr]${mask(cores)}`)
const kill = (pid) => spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })

async function waitFor(url, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // todavía no levantó
    }
    if (Date.now() > deadline) throw new Error(`${label} no respondió en ${timeoutMs / 1000} s`)
    await sleep(500)
  }
}

const live = []
function teardown() {
  for (const pid of live.splice(0)) kill(pid)
  spawnSync('docker', ['rm', '-f', LB_NAME], { stdio: 'ignore' })
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    teardown()
    process.exit(130)
  })
}

// nginx round-robin sobre las N instancias
async function startBalancer(n) {
  const upstream = Array.from({ length: n }, (_, k) => `    server host.docker.internal:${BASE_PORT + k};`).join('\n')
  const confPath = resolve(root, 'perf', 'scalability', 'nginx.generated.conf')
  writeFileSync(confPath, readFileSync(resolve(root, 'perf', 'scalability', 'nginx.conf.template'), 'utf8').replace('__UPSTREAM__', upstream))
  spawnSync('docker', ['rm', '-f', LB_NAME], { stdio: 'ignore' })
  const run = spawnSync('docker', ['run', '-d', '--name', LB_NAME, '-p', `${LB_PORT}:8080`, '--add-host=host.docker.internal:host-gateway', '-v', `${confPath}:/etc/nginx/nginx.conf:ro`, 'nginx:alpine'], { encoding: 'utf8' })
  if (run.status !== 0) throw new Error(`docker run: ${run.stderr}`)
  try {
    await waitFor(`http://127.0.0.1:${LB_PORT}/health`, 'balanceador')
  } catch (e) {
    console.error(spawnSync('docker', ['logs', '--tail', '20', LB_NAME], { encoding: 'utf8' }))
    throw e
  }
}

// proxy round-robin en Node, un hilo lógico propio
async function startNodeProxy(n) {
  const ports = Array.from({ length: n }, (_, k) => BASE_PORT + k).join(',')
  const proxy = spawn(process.execPath, [resolve(root, 'perf', 'scalability', 'proxy.mjs'), String(LB_PORT), ports], { stdio: 'inherit', windowsHide: true })
  live.push(proxy.pid)
  setAffinity(proxy.pid, [PROXY_CORE])
  await waitFor(`http://127.0.0.1:${LB_PORT}/health`, 'balanceador')
  return proxy.pid
}

async function runConfig(n) {
  const label = `${n}cpu${DIRECT ? "-direct" : ""}`
  const p = plan[n] ?? { start: 10, step: 5, steps: 8 }
  console.log(`\n[scalability] === ${label}: ${n} instancia(s), plan ${p.start} +${p.step} x${p.steps} it/s ===`)

  if (SEED) {
    const seed = spawnSync(process.execPath, [resolve(root, 'perf', 'seed', 'seed.mjs'), '--users=2000', '--reports=1000'], { cwd: root, stdio: 'inherit' })
    if (seed.status !== 0) throw new Error('falló el seed')
    // estadísticas al día y sin autovacuum pendiente antes de medir
    spawnSync('docker', ['exec', 'patitas-postgres', 'psql', '-U', 'patitas', '-d', 'patitas_perf', '-c', 'VACUUM ANALYZE'], { stdio: 'ignore' })
    await sleep(10_000)
  }

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: dbUrl,
    JWT_SECRET: process.env.JWT_SECRET ?? 'perf-jwt-secret-not-for-production',
    R2_PUBLIC_URL: process.env.PERF_R2_PUBLIC_URL ?? 'https://pub-e2e.r2.dev',
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY ?? 'perf-internal-key',
    AI_SERVICE_URL: `http://localhost:${AI_PORT}`,
  }
  const entry = resolve(root, 'backend', 'dist', 'index.js')
  if (!existsSync(entry)) throw new Error('falta backend/dist (npm run build)')

  const pids = []
  for (let k = 0; k < n; k++) {
    const log = createWriteStream(resolve(results, `scalability.${label}.inst${k + 1}.log`))
    const child = spawn(process.execPath, [entry], { cwd: resolve(root, 'backend'), env: { ...env, PORT: String(BASE_PORT + k) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    child.stdout.pipe(log)
    child.stderr.pipe(log)
    live.push(child.pid)
    pids.push(child.pid)
    setAffinity(child.pid, [BACKEND_CORES[k]])
  }
  for (let k = 0; k < n; k++) await waitFor(`http://127.0.0.1:${BASE_PORT + k}/health`, `instancia ${k + 1}`)

  let proxyPid = null
  if (!DIRECT) {
    if (BALANCER === 'nginx') await startBalancer(n)
    else proxyPid = await startNodeProxy(n)
  }

  // k6 sobre el balanceador (o la instancia 1 con --direct)
  const out = createWriteStream(resolve(results, `scalability.${label}.out.txt`))
  const k6 = spawn(
    'k6',
    ['run', '-e', `BASE_URL=http://127.0.0.1:${DIRECT ? BASE_PORT : LB_PORT}`, '-e', `SC_LABEL=${label}`, '-e', `SC_START_RATE=${p.start}`, '-e', `SC_RATE_STEP=${p.step}`, '-e', `SC_STEPS=${p.steps}`, '-e', `SC_STEP_S=${STEP_S}`, resolve(root, 'perf', 'scalability.js')],
    { cwd: root, env: { ...process.env, K6_WEB_DASHBOARD: 'true', K6_WEB_DASHBOARD_EXPORT: `perf/results/scalability.${label}.html` }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  )
  live.push(k6.pid)
  setAffinity(k6.pid, K6_CORES)
  k6.stdout.pipe(out)
  k6.stderr.pipe(out)
  k6.stdout.pipe(process.stdout)
  // sampler: CPU por instancia, CPU de k6 y conexiones pg
  const csv = resolve(results, `scalability.${label}.resources.csv`)
  const totalS = p.steps * (STEP_S + 1) + 90
  const sampler = spawn(process.execPath, [resolve(root, 'perf', 'scripts', 'sample-resources.mjs'), `--out=${csv}`, '--interval=3', `--duration=${totalS}`, `--pids=${pids.join(',')}`, `--aux-pids=${[k6.pid, proxyPid].filter(Boolean).join(",")}`], { cwd: root, stdio: 'inherit' })
  live.push(sampler.pid)

  const code = await new Promise((r) => k6.on('exit', r))
  await sleep(4000) // un último muestreo con el sistema ocioso
  kill(sampler.pid)

  const text = readFileSync(resolve(results, `scalability.${label}.out.txt`), 'utf8')
  const startMs = Number(/SC_START_MS=(\d+)/.exec(text)?.[1])
  writeFileSync(
    resolve(results, `scalability.${label}.meta.json`),
    JSON.stringify({ label, n, pids, cores: BACKEND_CORES.slice(0, n), k6Cores: K6_CORES, balancer: DIRECT ? 'none' : BALANCER, proxyCore: proxyPid ? PROXY_CORE : null, connectionLimitPerInstance: CONN_LIMIT, stepS: STEP_S, startMs, k6ExitCode: code }, null, 2),
  )
  teardown()
  await sleep(2000)
  console.log(`[scalability] ${label} terminado (k6 código ${code})`)
}

try {
  for (const n of NS) await runConfig(n)
} finally {
  teardown()
}
