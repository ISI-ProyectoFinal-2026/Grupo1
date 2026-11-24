// levanta el stub de IA y el backend para corridas de performance (Ctrl+C los detiene)
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = process.env.PORT ?? '3001'
const AI_PORT = process.env.AI_STUB_PORT ?? '8765'
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? 'perf-internal-key'

const env = {
  ...process.env,
  NODE_ENV: 'test', // saltea los rate limiters
  PORT,
  DATABASE_URL: process.env.PERF_DATABASE_URL ?? 'postgresql://patitas:patitas@localhost:5433/patitas_perf',
  JWT_SECRET: process.env.JWT_SECRET ?? 'perf-jwt-secret-not-for-production',
  R2_PUBLIC_URL: process.env.PERF_R2_PUBLIC_URL ?? 'https://pub-e2e.r2.dev',
  INTERNAL_API_KEY,
  AI_SERVICE_URL: `http://localhost:${AI_PORT}`,
  AI_STUB_PORT: AI_PORT,
}

if (!/perf/i.test(new URL(env.DATABASE_URL).pathname)) {
  console.error('[start-env] DATABASE_URL no parece de performance. Abortado.')
  process.exit(1)
}

const children = []
function run(label, command, args, cwd) {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit' })
  child.on('exit', (code) => console.log(`[${label}] terminó con código ${code}`))
  children.push(child)
}

function stopAll() {
  for (const child of children) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    else child.kill('SIGTERM')
  }
}
process.on('SIGINT', () => {
  stopAll()
  setTimeout(() => process.exit(0), 500)
})
process.on('SIGTERM', () => {
  stopAll()
  setTimeout(() => process.exit(0), 500)
})

const backendDir = resolve(root, 'backend')
run('ai-stub', process.execPath, [resolve(root, 'frontend', 'e2e', 'support', 'ai-stub-server.ts')], root)
run('backend', process.execPath, [resolve(backendDir, 'node_modules', 'ts-node', 'dist', 'bin.js'), 'src/index.ts'], backendDir)

// espera a que el backend responda
const deadline = Date.now() + 120_000
for (;;) {
  try {
    const res = await fetch(`http://localhost:${PORT}/health`)
    if (res.ok) break
  } catch {
    // todavía no levantó
  }
  if (Date.now() > deadline) {
    console.error('[start-env] el backend no respondió en 120 s')
    stopAll()
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, 1000))
}
console.log(`[start-env] backend listo en http://localhost:${PORT}`)
