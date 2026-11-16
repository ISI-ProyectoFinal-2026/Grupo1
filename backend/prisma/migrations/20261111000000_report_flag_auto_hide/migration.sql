-- Estado oculto (#218); no se usa en esta migración
ALTER TYPE "report_status" ADD VALUE 'hidden';

-- Motivos tipados de denuncia
CREATE TYPE "report_flag_reason" AS ENUM ('not_an_animal', 'offensive', 'spam', 'duplicate', 'false_info', 'other');

-- Reportes: ciclo de denuncias y última edición del autor
ALTER TABLE "reports" ADD COLUMN "flag_cycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "content_edited_at" TIMESTAMP(3);

-- Denuncias: el texto libre actual pasa a detail y el motivo queda en other
ALTER TABLE "report_flags" ADD COLUMN "detail" TEXT,
ADD COLUMN "cycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "resolved_at" TIMESTAMP(3);

UPDATE "report_flags" SET "detail" = "reason";
UPDATE "report_flags" SET "resolved_at" = "created_at" WHERE "status" <> 'pending';

ALTER TABLE "report_flags" ALTER COLUMN "reason" TYPE "report_flag_reason" USING 'other'::"report_flag_reason";

-- Una denuncia por usuario y ciclo
DROP INDEX "report_flags_report_id_user_id_key";
CREATE UNIQUE INDEX "report_flags_report_id_user_id_cycle_key" ON "report_flags"("report_id", "user_id", "cycle");
