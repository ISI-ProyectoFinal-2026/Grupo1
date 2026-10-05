/**
 * Minimal stand-in for backend-ia, started by playwright.config.ts as a
 * webServer. Runs with Node's built-in type stripping (no build step).
 *
 * - POST /images/analyze -> 200 { has_animal: true } (synchronous screening).
 * - POST /reports/:id/embedding -> AI_STUB_EMBEDDING_STATUS (default 409).
 *   The backend's pending-report reconciliation runs at boot against the WHOLE
 *   database: answering 201 would publish a developer's real pending reports.
 *   409 is a deliberate "inconclusive" answer: no retry, no state change.
 * - GET /health -> readiness probe for Playwright.
 *
 * The browser journeys create reports without image, so they never reach the
 * AI; the stub exists so the backend never waits on a missing service.
 */
import { createServer } from 'node:http'

const port = Number(process.env.AI_STUB_PORT ?? 8765)
const internalKey = process.env.INTERNAL_API_KEY ?? ''
const embeddingStatus = Number(process.env.AI_STUB_EMBEDDING_STATUS ?? 409)

const server = createServer((req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  // Drain the body: the backend always sends JSON, its content is irrelevant.
  req.resume()
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
      send(200, { has_animal: true })
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
