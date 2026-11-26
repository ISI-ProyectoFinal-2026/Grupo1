// corre lhci (collect, assert, upload) para mobile y desktop; agrega /reports/<id> a las URLs
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LHCI = '@lhci/cli@0.15.1'
const origin = process.env.LH_ORIGIN ?? 'http://localhost:4173'
const modes = (process.env.LH_MODES ?? 'mobile,desktop').split(',')
const ids = JSON.parse(readFileSync(resolve(root, 'perf/data/report-ids.json'), 'utf8'))
const outBase = resolve(root, 'perf/results/lighthouse')
mkdirSync(outBase, { recursive: true })

let failed = false
for (const mode of modes) {
  const cfg = JSON.parse(readFileSync(resolve(root, `perf/lighthouserc.${mode}.json`), 'utf8'))
  cfg.ci.collect.url = [...cfg.ci.collect.url.map((u) => u.replace('http://localhost:4173', origin)), `${origin}/reports/${ids[0]}`]
  const tmp = resolve(outBase, `.rc.${mode}.json`)
  writeFileSync(tmp, JSON.stringify(cfg, null, 2))
  rmSync(resolve(root, '.lighthouseci'), { recursive: true, force: true })
  rmSync(resolve(root, cfg.ci.upload.outputDir), { recursive: true, force: true })
  for (const cmd of ['collect', 'assert', 'upload']) {
    const r = spawnSync('npx', ['-y', LHCI, cmd, `--config="${tmp}"`], { cwd: root, stdio: 'inherit', shell: true })
    if (r.status !== 0) {
      console.error(`[lighthouse] ${mode} ${cmd} terminó con código ${r.status}`)
      if (cmd !== 'assert') process.exit(r.status ?? 1)
      failed = true // assert falla: se siguen generando los artefactos
    }
  }
  rmSync(tmp, { force: true })
}
rmSync(resolve(root, '.lighthouseci'), { recursive: true, force: true })
process.exit(failed ? 2 : 0)
