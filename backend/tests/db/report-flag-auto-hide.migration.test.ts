import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../../src/db/client";

const MIGRATION_SQL = readFileSync(
  join(__dirname, "../../prisma/migrations/20261111000000_report_flag_auto_hide/migration.sql"),
  "utf8"
);

// Prisma no admite varias sentencias por llamada
const statements = (sql: string) =>
  sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

/** Aborta la transacción a propósito para no dejar rastro. */
class Rollback extends Error {}

interface FlagRow {
  id: number;
  reason: string;
  detail: string | null;
  status: string;
  cycle: number;
  resolved_at: Date | null;
}

describe("migración 20261111000000_report_flag_auto_hide", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("las denuncias legacy pasan a reason=other con su texto en detail y los reportes rejected no cambian", async () => {
    let flags: FlagRow[] = [];
    let reports: { id: number; status: string; flag_cycle: number }[] = [];
    let duplicateInNewCycle = false;

    try {
      await prisma.$transaction(async (tx) => {
        // esquema aislado con la forma previa a la migración
        await tx.$executeRawUnsafe(`CREATE SCHEMA mig_test_hide`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO mig_test_hide`);
        const legacySql = `
          CREATE TYPE report_status AS ENUM ('pending', 'published', 'rejected', 'resolved');
          CREATE TYPE report_flag_status AS ENUM ('pending', 'reviewed', 'dismissed');
          CREATE TABLE reports (id SERIAL PRIMARY KEY, status report_status NOT NULL);
          CREATE TABLE report_flags (
            id SERIAL PRIMARY KEY,
            report_id INTEGER NOT NULL REFERENCES reports(id),
            user_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            status report_flag_status NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE UNIQUE INDEX report_flags_report_id_user_id_key ON report_flags(report_id, user_id);
          INSERT INTO reports (status) VALUES ('published'), ('rejected');
          INSERT INTO report_flags (report_id, user_id, reason, status) VALUES
            (1, 10, 'es spam', 'pending'),
            (1, 11, 'otra cosa', 'dismissed');
        `;
        for (const statement of statements(legacySql)) await tx.$executeRawUnsafe(statement);

        for (const statement of statements(MIGRATION_SQL)) await tx.$executeRawUnsafe(statement);

        flags = await tx.$queryRawUnsafe<FlagRow[]>(
          `SELECT id, reason::text AS reason, detail, status::text AS status, cycle, resolved_at FROM report_flags ORDER BY id`
        );
        reports = await tx.$queryRawUnsafe(`SELECT id, status::text AS status, flag_cycle FROM reports ORDER BY id`);

        // misma persona en otro ciclo: permitido por la nueva unicidad
        await tx.$executeRawUnsafe(
          `INSERT INTO report_flags (report_id, user_id, reason, cycle) VALUES (1, 10, 'spam', 1)`
        );
        duplicateInNewCycle = true;
        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }

    expect(flags[0]).toMatchObject({ reason: "other", detail: "es spam", status: "pending", cycle: 0, resolved_at: null });
    expect(flags[1]).toMatchObject({ reason: "other", detail: "otra cosa", status: "dismissed", cycle: 0 });
    expect(flags[1].resolved_at).toBeInstanceOf(Date);
    expect(reports).toEqual([
      { id: 1, status: "published", flag_cycle: 0 },
      { id: 2, status: "rejected", flag_cycle: 0 },
    ]);
    expect(duplicateInNewCycle).toBe(true);
  });
});
