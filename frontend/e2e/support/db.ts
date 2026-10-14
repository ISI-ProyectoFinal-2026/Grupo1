/**
 * Direct DB access for what has no public endpoint: promoting a role and
 * seeding an AI match. Plain `pg` with raw SQL instead of reusing the
 * backend's Prisma client: no cross-package import, no ts-node spawn per call,
 * and the table names are already fixed by the migrations (@@map).
 */
import { createHash } from 'node:crypto'
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

type Role = 'usuario_regular' | 'moderador' | 'admin'

export async function setRole(userId: number, role: Role): Promise<void> {
  await db().query('UPDATE users SET role = $1::role WHERE id = $2', [role, userId])
}

/**
 * Marks the email as verified, the way following the mailed link would. Creating
 * reports, uploading images and chatting require it (EMAIL_NOT_VERIFIED
 * otherwise), so every user that does those must go through here.
 */
export async function markEmailVerified(email: string): Promise<void> {
  await db().query('UPDATE users SET email_verified_at = now() WHERE email = $1', [email])
}

type AuthTokenType =
  | 'email_verification'
  | 'password_reset'
  | 'two_factor_login'
  | 'two_factor_reset'
  | 'two_factor_reset_cancel'

/**
 * Seeds a mail-link token whose raw value the test knows. The DB only keeps the
 * sha256, so the real token (which only travels by mail) can't be recovered:
 * instead we store the hash of one we chose, exactly as issueAuthToken would.
 * Issuing a token invalidates the earlier unused ones, so call this AFTER any
 * resend/forgot request, never before.
 */
export async function insertAuthToken(email: string, type: AuthTokenType, rawToken: string): Promise<void> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const { rowCount } = await db().query(
    `INSERT INTO auth_tokens (user_id, type, token_hash, expires_at)
     SELECT id, $2::auth_token_type, $3, now() + interval '30 minutes' FROM users WHERE email = $1`,
    [email, type, tokenHash],
  )
  if (rowCount !== 1) throw new Error(`insertAuthToken: no user with email ${email}`)
}

/**
 * Waits until the user has an unused token of that type. forgot-password issues
 * it in the background after answering, so the response alone doesn't guarantee
 * it exists yet (and a late insert would invalidate the one seeded by the test).
 */
export async function waitForAuthToken(email: string, type: AuthTokenType, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { rowCount } = await db().query(
      `SELECT 1 FROM auth_tokens t JOIN users u ON u.id = t.user_id
       WHERE u.email = $1 AND t.type = $2::auth_token_type AND t.used_at IS NULL`,
      [email, type],
    )
    if (rowCount) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`waitForAuthToken: no ${type} token for ${email} after ${timeoutMs}ms`)
}

/** Pushes the newest token of that type 61s into the past, past the 60s resend cooldown. */
export async function ageLatestToken(email: string, type: AuthTokenType): Promise<void> {
  await db().query(
    `UPDATE auth_tokens SET created_at = created_at - interval '61 seconds'
     WHERE id = (
       SELECT t.id FROM auth_tokens t JOIN users u ON u.id = t.user_id
       WHERE u.email = $1 AND t.type = $2::auth_token_type
       ORDER BY t.created_at DESC LIMIT 1
     )`,
    [email, type],
  )
}

/**
 * Enabling (and every accepted TOTP) records the step it consumed, so the same
 * code is rejected as a replay for the rest of its 30 s window. Journeys that
 * compute a code right after another one cleared it here instead of waiting.
 */
export async function resetTwoFactorLastStep(email: string): Promise<void> {
  await db().query('UPDATE users SET two_factor_last_step = NULL WHERE email = $1', [email])
}

/**
 * Moves a pending reset's start 72 h back, so the wait is over without waiting.
 * The backend compares the column with the DB clock, which is what this shifts.
 */
export async function ageTwoFactorReset(email: string): Promise<void> {
  const { rowCount } = await db().query(
    `UPDATE users SET two_factor_reset_requested_at = two_factor_reset_requested_at - interval '72 hours'
     WHERE email = $1 AND two_factor_reset_requested_at IS NOT NULL`,
    [email],
  )
  if (rowCount !== 1) throw new Error(`ageTwoFactorReset: no pending reset for ${email}`)
}

interface TwoFactorState {
  enabled: boolean
  hasSecret: boolean
  locked: boolean
  failedAttempts: number
  resetPending: boolean
  unusedRecoveryCodes: number
}

/** What the journeys assert on directly: nothing here is exposed that way by the API. */
export async function getTwoFactorState(email: string): Promise<TwoFactorState> {
  const { rows } = await db().query<{
    enabled: boolean
    has_secret: boolean
    locked: boolean
    failed_attempts: number
    reset_pending: boolean
    unused_codes: string
  }>(
    `SELECT u.two_factor_enabled_at IS NOT NULL AS enabled,
            u.two_factor_secret_enc IS NOT NULL AS has_secret,
            u.two_factor_locked_until IS NOT NULL AS locked,
            u.two_factor_failed_attempts AS failed_attempts,
            u.two_factor_reset_requested_at IS NOT NULL AS reset_pending,
            (SELECT count(*) FROM two_factor_recovery_codes c WHERE c.user_id = u.id AND c.used_at IS NULL) AS unused_codes
     FROM users u WHERE u.email = $1`,
    [email],
  )
  const row = rows[0]
  if (!row) throw new Error(`getTwoFactorState: no user with email ${email}`)
  return {
    enabled: row.enabled,
    hasSecret: row.has_secret,
    locked: row.locked,
    failedAttempts: row.failed_attempts,
    resetPending: row.reset_pending,
    unusedRecoveryCodes: Number(row.unused_codes),
  }
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
