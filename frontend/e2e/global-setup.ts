import { closeDb, deleteAllE2EUsers } from './support/db.ts'

/**
 * Each test deletes its own users on teardown; this only catches what an
 * aborted run (Ctrl+C, crash) left behind, so runs stay idempotent.
 */
export default async function globalSetup(): Promise<void> {
  await deleteAllE2EUsers()
  await closeDb()
}
