/**
 * Direct DB access for what has no public endpoint: promoting a role and
 * seeding an AI match. Plain `pg` with raw SQL instead of reusing the
 * backend's Prisma client: no cross-package import, no ts-node spawn per call,
 * and the table names are already fixed by the migrations (@@map).
 */
import pg from 'pg'
import { DATABASE_URL, E2E_EMAIL_DOMAIN, E2E_EMAIL_PREFIX } from './env.ts'

let pool: pg.Pool | undefined

function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: DATABASE_URL, max: 2 })
  return pool
}

export async function closeDb(): Promise<void> {
  await pool?.end()
  pool = undefined
}

export type Role = 'usuario_regular' | 'moderador' | 'admin'

export async function setRole(userId: number, role: Role): Promise<void> {
  await db().query('UPDATE users SET role = $1::role WHERE id = $2', [role, userId])
}

/** Same row backend-ia writes when it finds a candidate (matching_service.py). */
export async function seedMatch(lostReportId: number, foundReportId: number, similarityScore: number): Promise<number> {
  const { rows } = await db().query<{ id: number }>(
    `INSERT INTO report_matches (report_lost_id, report_found_id, similarity_score, status)
     VALUES ($1, $2, $3, 'pending') RETURNING id`,
    [lostReportId, foundReportId, similarityScore],
  )
  return rows[0].id
}

export async function getMatchStatus(matchId: number): Promise<string | undefined> {
  const { rows } = await db().query<{ status: string }>('SELECT status FROM report_matches WHERE id = $1', [matchId])
  return rows[0]?.status
}

/**
 * Deletes the given users and everything hanging from them, children first
 * (no FK in the schema cascades except business_events). Rows created by OTHER
 * users on these users' reports (flags, matches, chats) go too. Mirrors
 * backend/tests/e2e/helpers/factories.ts#cleanupE2EData.
 */
export async function deleteUsersByEmail(emails: string[]): Promise<void> {
  if (emails.length === 0) return
  const client = await db().connect()
  try {
    await client.query('BEGIN')
    const users = await client.query<{ id: number }>('SELECT id FROM users WHERE email = ANY($1)', [emails])
    const userIds = users.rows.map((u) => u.id)
    if (userIds.length > 0) {
      await client.query(
        `CREATE TEMP TABLE e2e_reports ON COMMIT DROP AS SELECT id FROM reports WHERE user_id = ANY($1)`,
        [userIds],
      )
      await client.query(
        `CREATE TEMP TABLE e2e_chats ON COMMIT DROP AS
           SELECT id FROM chats
           WHERE user_a_id = ANY($1) OR user_b_id = ANY($1) OR report_id IN (SELECT id FROM e2e_reports)`,
        [userIds],
      )
      const steps: Array<[string, unknown[]]> = [
        ['DELETE FROM notifications WHERE user_id = ANY($1) OR report_id IN (SELECT id FROM e2e_reports)', [userIds]],
        [
          `DELETE FROM report_matches
           WHERE report_lost_id IN (SELECT id FROM e2e_reports) OR report_found_id IN (SELECT id FROM e2e_reports)`,
          [],
        ],
        ['DELETE FROM report_flags WHERE user_id = ANY($1) OR report_id IN (SELECT id FROM e2e_reports)', [userIds]],
        ['DELETE FROM messages WHERE chat_id IN (SELECT id FROM e2e_chats) OR sender_id = ANY($1)', [userIds]],
        ['DELETE FROM chats WHERE id IN (SELECT id FROM e2e_chats)', []],
        ['DELETE FROM report_embeddings WHERE report_id IN (SELECT id FROM e2e_reports)', []],
        ['DELETE FROM reports WHERE id IN (SELECT id FROM e2e_reports)', []],
        ['DELETE FROM pets WHERE user_id = ANY($1)', [userIds]],
        ['DELETE FROM businesses WHERE user_id = ANY($1)', [userIds]],
        ['DELETE FROM users WHERE id = ANY($1)', [userIds]],
      ]
      for (const [sql, params] of steps) {
        await client.query(sql, params)
      }
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Purges leftovers of aborted runs (killed before the per-test teardown). */
export async function deleteAllE2EUsers(): Promise<void> {
  const { rows } = await db().query<{ email: string }>('SELECT email FROM users WHERE email LIKE $1', [
    `${E2E_EMAIL_PREFIX}%@${E2E_EMAIL_DOMAIN}`,
  ])
  await deleteUsersByEmail(rows.map((r) => r.email))
}
