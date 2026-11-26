// seed reproducible para la base de performance (nunca producción)
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// pg vive en frontend/ (e2e) y bcryptjs en backend/: se resuelven desde ahí
const pg = createRequire(resolve(root, 'frontend', 'package.json'))('pg')
const bcrypt = createRequire(resolve(root, 'backend', 'package.json'))('bcryptjs')

// parámetros: flags --users --reports --seed o variables PERF_*
const flags = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')
    return [key, value]
  }),
)
const USERS = Number(flags.users ?? process.env.PERF_USERS ?? 20)
const REPORTS = Number(flags.reports ?? process.env.PERF_REPORTS ?? 200)
const SEED = Number(flags.seed ?? process.env.PERF_SEED ?? 42)
const DATABASE_URL =
  process.env.PERF_DATABASE_URL ?? 'postgresql://patitas:patitas@localhost:5433/patitas_perf'
const R2_PUBLIC_URL = process.env.PERF_R2_PUBLIC_URL ?? 'https://pub-e2e.r2.dev'
const PASSWORD = 'Patitas123'
const BCRYPT_COST = 12 // igual a SALT_ROUNDS del backend
const EMAIL_PREFIX = 'perf-user-'
const EMAIL_DOMAIN = 'example.com'
const IMAGE_VARIANTS = 20
const MATCH_RATIO = 0.1

// protección: solo bases cuyo nombre indique performance
const dbName = new URL(DATABASE_URL).pathname.replace('/', '')
if (!/perf/i.test(dbName) && process.env.PERF_ALLOW_ANY_DB !== '1') {
  console.error(`[seed] la base "${dbName}" no parece de performance (debe contener "perf"). Abortado.`)
  process.exit(1)
}
if (!Number.isInteger(USERS) || USERS < 1 || !Number.isInteger(REPORTS) || REPORTS < 1) {
  console.error('[seed] --users y --reports deben ser enteros positivos')
  process.exit(1)
}

// PRNG determinístico (mulberry32)
function prng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = prng(SEED)
const gauss = () => (rand() + rand() + rand() + rand() - 2) / 0.58

// ciudades de Argentina: centro y dispersión en grados
const CITIES = [
  { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816, spread: 0.12, weight: 4 },
  { name: 'Córdoba', lat: -31.4201, lng: -64.1888, spread: 0.08, weight: 2 },
  { name: 'Rosario', lat: -32.9442, lng: -60.6505, spread: 0.07, weight: 2 },
  { name: 'Mendoza', lat: -32.8908, lng: -68.8272, spread: 0.07, weight: 1 },
  { name: 'Tucumán', lat: -26.8083, lng: -65.2176, spread: 0.06, weight: 1 },
  { name: 'La Plata', lat: -34.9205, lng: -57.9536, spread: 0.06, weight: 1 },
]
const totalWeight = CITIES.reduce((sum, c) => sum + c.weight, 0)
function pickCity() {
  let r = rand() * totalWeight
  for (const city of CITIES) {
    r -= city.weight
    if (r <= 0) return city
  }
  return CITIES[0]
}

const SPECIES = ['perro', 'gato']
const COLORS = ['negro', 'blanco', 'marrón', 'gris', 'naranja', 'atigrado', 'manchado']

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 })

// borra las filas perf-* y lo que cuelga de ellas (hijos primero)
async function clearPerfRows(client) {
  const { rows } = await client.query('SELECT id FROM users WHERE email LIKE $1', [`${EMAIL_PREFIX}%@${EMAIL_DOMAIN}`])
  const userIds = rows.map((r) => r.id)
  if (userIds.length === 0) return 0
  await client.query('CREATE TEMP TABLE perf_reports ON COMMIT DROP AS SELECT id FROM reports WHERE user_id = ANY($1)', [userIds])
  await client.query(
    `CREATE TEMP TABLE perf_chats ON COMMIT DROP AS
       SELECT id FROM chats WHERE user_a_id = ANY($1) OR user_b_id = ANY($1) OR report_id IN (SELECT id FROM perf_reports)`,
    [userIds],
  )
  const steps = [
    ['DELETE FROM notifications WHERE user_id = ANY($1) OR report_id IN (SELECT id FROM perf_reports)', [userIds]],
    ['DELETE FROM report_matches WHERE report_lost_id IN (SELECT id FROM perf_reports) OR report_found_id IN (SELECT id FROM perf_reports)', []],
    ['DELETE FROM report_flags WHERE user_id = ANY($1) OR report_id IN (SELECT id FROM perf_reports)', [userIds]],
    ['DELETE FROM messages WHERE chat_id IN (SELECT id FROM perf_chats) OR sender_id = ANY($1)', [userIds]],
    ['DELETE FROM chats WHERE id IN (SELECT id FROM perf_chats)', []],
    ['DELETE FROM report_embeddings WHERE report_id IN (SELECT id FROM perf_reports)', []],
    ['DELETE FROM reports WHERE id IN (SELECT id FROM perf_reports)', []],
    ['DELETE FROM pets WHERE user_id = ANY($1)', [userIds]],
    ['DELETE FROM ad_flags WHERE user_id = ANY($1)', [userIds]],
    ['DELETE FROM businesses WHERE user_id = ANY($1)', [userIds]],
    ['DELETE FROM role_change_audits WHERE actor_id = ANY($1) OR target_id = ANY($1)', [userIds]],
    ['DELETE FROM users WHERE id = ANY($1)', [userIds]],
  ]
  for (const [sql, params] of steps) await client.query(sql, params)
  return userIds.length
}

async function main() {
  console.log(`[seed] db=${dbName} users=${USERS} reports=${REPORTS} seed=${SEED}`)
  const started = Date.now()
  const passwordHash = bcrypt.hashSync(PASSWORD, BCRYPT_COST)
  const client = await pool.connect()
  let userRows
  let reportIds
  try {
    await client.query('BEGIN')
    const removed = await clearPerfRows(client)
    if (removed) console.log(`[seed] filas previas eliminadas: ${removed} usuarios`)

    // usuarios verificados
    const emails = Array.from({ length: USERS }, (_, i) => `${EMAIL_PREFIX}${i + 1}@${EMAIL_DOMAIN}`)
    const names = emails.map((_, i) => `Perf User ${i + 1}`)
    const inserted = await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, email_verified_at, updated_at)
       SELECT e, $3, n, 'usuario_regular', now(), now() FROM unnest($1::text[], $2::text[]) AS t(e, n)
       RETURNING id, email`,
      [emails, names, passwordHash],
    )
    userRows = inserted.rows.sort((a, b) => a.id - b.id)

    // reportes publicados, repartidos entre usuarios
    const cols = { user: [], type: [], title: [], desc: [], img: [], addr: [], lng: [], lat: [], event: [] }
    const today = Date.now()
    for (let i = 0; i < REPORTS; i++) {
      const city = pickCity()
      const type = rand() < 0.5 ? 'lost' : 'found'
      const species = SPECIES[Math.floor(rand() * SPECIES.length)]
      const color = COLORS[Math.floor(rand() * COLORS.length)]
      cols.user.push(userRows[i % userRows.length].id)
      cols.type.push(type)
      cols.title.push(`${type === 'lost' ? 'Perdido' : 'Encontrado'}: ${species} ${color} #${i + 1}`)
      cols.desc.push(`Reporte de performance ${i + 1}, ${species} de color ${color}`)
      cols.img.push(`${R2_PUBLIC_URL}/pets/perf-${i % IMAGE_VARIANTS}.jpg`)
      cols.addr.push(city.name)
      cols.lng.push(Number((city.lng + gauss() * city.spread).toFixed(6)))
      cols.lat.push(Number((city.lat + gauss() * city.spread).toFixed(6)))
      cols.event.push(new Date(today - Math.floor(rand() * 30) * 86400000).toISOString().slice(0, 10))
    }
    const reports = await client.query(
      `INSERT INTO reports (user_id, report_type, status, title, description, image_url, location_address,
                            location, event_date, published_at, created_at, updated_at, last_activity_at)
       SELECT u, t::report_type, 'published', ti, d, im, ad, ST_SetSRID(ST_MakePoint(lo, la), 4326), ev::date,
              now(), now() - (n || ' seconds')::interval, now(), now()
       FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::float8[], $8::float8[], $9::text[])
            WITH ORDINALITY AS x(u, t, ti, d, im, ad, lo, la, ev, n)
       RETURNING id, report_type`,
      [cols.user, cols.type, cols.title, cols.desc, cols.img, cols.addr, cols.lng, cols.lat, cols.event],
    )
    reportIds = reports.rows.map((r) => r.id).sort((a, b) => a - b)

    // coincidencias sintéticas (sin embeddings): lost <-> found
    const lost = reports.rows.filter((r) => r.report_type === 'lost').map((r) => r.id)
    const found = reports.rows.filter((r) => r.report_type === 'found').map((r) => r.id)
    const pairs = Math.min(Math.floor(REPORTS * MATCH_RATIO), lost.length, found.length)
    const mLost = []
    const mFound = []
    const mScore = []
    for (let i = 0; i < pairs; i++) {
      mLost.push(lost[i])
      mFound.push(found[(i * 7) % found.length])
      mScore.push(Number((0.6 + rand() * 0.39).toFixed(4)))
    }
    if (pairs > 0) {
      await client.query(
        `INSERT INTO report_matches (report_lost_id, report_found_id, similarity_score, status)
         SELECT l, f, s, 'pending' FROM unnest($1::int[], $2::int[], $3::float8[]) AS t(l, f, s)
         ON CONFLICT DO NOTHING`,
        [mLost, mFound, mScore],
      )
    }
    await client.query('COMMIT')
    console.log(`[seed] matches sintéticos: ${pairs}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  await pool.query('ANALYZE users')
  await pool.query('ANALYZE reports')

  const dataDir = resolve(root, 'perf', 'data')
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(
    resolve(dataDir, 'users.json'),
    JSON.stringify(userRows.map((u) => ({ email: u.email, password: PASSWORD })), null, 2),
  )
  writeFileSync(resolve(dataDir, 'report-ids.json'), JSON.stringify(reportIds))
  console.log(`[seed] listo en ${((Date.now() - started) / 1000).toFixed(1)} s: ${userRows.length} usuarios, ${reportIds.length} reportes`)
  await pool.end()
}

main().catch(async (error) => {
  console.error('[seed] error:', error)
  await pool.end().catch(() => {})
  process.exit(1)
})
