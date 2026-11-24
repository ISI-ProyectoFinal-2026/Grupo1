/**
 * Minimal stand-in for backend-ia, started by playwright.config.ts as a
 * webServer. Runs with Node's built-in type stripping (no build step).
 *
 * - POST /images/analyze -> 200 { has_animal, low_quality } (synchronous
 *   screening). low_quality is true only for image URLs containing
 *   LOW_QUALITY_MARKER, so a spec can ask for the blurry-photo warning (#212);
 *   has_animal is false only for NO_ANIMAL_MARKER (custom flyer screening, #311).
 * - POST /images/embedding -> for the MATCH_IMAGES markers, 200 with a pet
 *   embedding (the backend stores it, runs the matching and publishes the
 *   report, F2). Anything else -> AI_STUB_EMBEDDING_STATUS (default 409).
 *   The backend's pending-report reconciliation runs at boot against the WHOLE
 *   database: answering with a pet would publish a developer's real pending
 *   reports. 409 is a deliberate "inconclusive" answer: no retry, no state change.
 * - GET /health -> readiness probe for Playwright.
 *
 * Reports always carry a photo (mandatory); outside F2 the embedding answer keeps
 * them pending and the specs publish them straight in the DB; the stub exists so
 * the backend never waits on a missing service.
 */
import { createServer } from 'node:http'

const port = Number(process.env.AI_STUB_PORT ?? 8765)
const internalKey = process.env.INTERNAL_API_KEY ?? ''
const embeddingStatus = Number(process.env.AI_STUB_EMBEDDING_STATUS ?? 409)
// keep in sync with E2E_LOW_QUALITY_IMAGE_URL (env.ts)
const LOW_QUALITY_MARKER = 'e2e-low-quality'
// keep in sync with E2E_NO_ANIMAL_IMAGE_URL (env.ts)
const NO_ANIMAL_MARKER = 'e2e-no-animal'

// unit vectors 0.87 cosine apart; keep in sync with E2E_MATCH_*_IMAGE_URL (env.ts)
const EMBEDDING_DIM = 768
const unitVectorAtCosine = (cosine: number): number[] => [
  cosine,
  Math.sqrt(1 - cosine ** 2),
  ...Array<number>(EMBEDDING_DIM - 2).fill(0),
]
const MATCH_IMAGES: Record<string, number[]> = {
  'e2e-match-lost': unitVectorAtCosine(1),
  'e2e-match-found': unitVectorAtCosine(0.87),
}

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
      send(200, { has_animal: !imageUrl.includes(NO_ANIMAL_MARKER), low_quality: imageUrl.includes(LOW_QUALITY_MARKER) })
      return
    }
    if (req.method === 'POST' && path === '/images/embedding') {
      const imageUrl = String((JSON.parse(raw || '{}') as { image_url?: unknown }).image_url ?? '')
      const marker = Object.keys(MATCH_IMAGES).find((key) => imageUrl.includes(key))
      if (marker) {
        send(200, { has_animal: true, embedding: MATCH_IMAGES[marker] })
      } else {
        send(embeddingStatus, { detail: 'e2e ai stub' })
      }
      return
    }
    send(404, { detail: `e2e ai stub: no route for ${req.method} ${path}` })
  })
})

server.listen(port, () => {
  console.log(`[ai-stub] listening on ${port}`)
})
