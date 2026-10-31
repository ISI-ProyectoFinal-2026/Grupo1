/**
 * Minimal stand-in for backend-ia, started by playwright.config.ts as a
 * webServer. Runs with Node's built-in type stripping (no build step).
 *
 * - POST /images/analyze -> 200 { has_animal: true, low_quality } (synchronous
 *   screening). low_quality is true only for image URLs containing
 *   LOW_QUALITY_MARKER, so a spec can ask for the blurry-photo warning (#212).
 * - POST /reports/:id/embedding -> AI_STUB_EMBEDDING_STATUS (default 409).
 *   The backend's pending-report reconciliation runs at boot against the WHOLE
 *   database: answering 201 would publish a developer's real pending reports.
 *   409 is a deliberate "inconclusive" answer: no retry, no state change.
 * - GET /health -> readiness probe for Playwright.
 *
 * Reports always carry a photo (mandatory); the embedding answer keeps them
 * pending and the specs publish them straight in the DB, so they never reach the
 * AI; the stub exists so the backend never waits on a missing service.
 */
import { createServer } from 'node:http'

const port = Number(process.env.AI_STUB_PORT ?? 8765)
const internalKey = process.env.INTERNAL_API_KEY ?? ''
const embeddingStatus = Number(process.env.AI_STUB_EMBEDDING_STATUS ?? 409)
// keep in sync with E2E_LOW_QUALITY_IMAGE_URL (env.ts)
const LOW_QUALITY_MARKER = 'e2e-low-quality'

const server = createServer((req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  let raw = ''
  req.setEncoding('utf8')
  req.on('data', (chunk: string) => {
    raw += chunk
  })
  req.on('end', () => {
    const path = new URL(req.url ?? '/', 'http://stub').pathname

    if (req.method === 'GET' && path === '/health') {
      send(200, { status: 'ok' })
      return
    }
    if (req.headers['x-internal-key'] !== internalKey) {
      send(401, { detail: 'invalid internal key' })
      return
    }
    if (req.method === 'POST' && path === '/images/analyze') {
      const imageUrl = String((JSON.parse(raw || '{}') as { image_url?: unknown }).image_url ?? '')
      send(200, { has_animal: true, low_quality: imageUrl.includes(LOW_QUALITY_MARKER) })
      return
    }
    if (req.method === 'POST' && /^\/reports\/\d+\/embedding$/.test(path)) {
      send(embeddingStatus, { detail: 'e2e ai stub' })
      return
    }
    send(404, { detail: `e2e ai stub: no route for ${req.method} ${path}` })
  })
})

server.listen(port, () => {
  console.log(`[ai-stub] listening on ${port}`)
})
