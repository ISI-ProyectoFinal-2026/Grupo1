// captura el dashboard 'Carga y recursos' de un intervalo a PNG
// uso: node perf/observability/capture.mjs --from=<ms epoch> --to=<ms epoch> --out=<png> [--testid=ID] [--grafana=http://localhost:3000]
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? def
const { chromium } = createRequire(resolve(root, 'frontend', 'package.json'))('playwright')

const base = process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, 'ms-playwright') : ''
const dir = existsSync(base) ? readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().pop() : undefined
const executablePath = process.env.CHROME_PATH ?? (dir ? resolve(base, dir, 'chrome-win64', 'chrome.exe') : undefined)

const params = new URLSearchParams({ orgId: '1', from: arg('from'), to: arg('to'), kiosk: 'true' })
if (arg('testid')) params.set('var-testid', arg('testid'))
const url = `${arg('grafana', 'http://localhost:3000')}/d/perf-carga-recursos/carga-y-recursos?${params}`

const browser = await chromium.launch({ executablePath })
const page = await browser.newPage({ viewport: { width: 1600, height: 1300 } })
await page.goto(url)
await page.waitForTimeout(12000) // deja renderizar los paneles
await page.screenshot({ path: resolve(root, arg('out')) })
await browser.close()
console.log(`[capture] ${arg('out')}`)
