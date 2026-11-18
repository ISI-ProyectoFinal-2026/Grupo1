-- Cierre por inactividad (#264)
CREATE TYPE "report_closed_reason" AS ENUM ('manual', 'inactivity');

ALTER TABLE "reports" ADD COLUMN "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "inactivity_warned_30_at" TIMESTAMP(3),
ADD COLUMN "inactivity_warned_37_at" TIMESTAMP(3),
ADD COLUMN "closed_reason" "report_closed_reason",
ADD COLUMN "closed_at" TIMESTAMP(3);

-- Reportes existentes: la actividad parte de la publicación (o la creación)
UPDATE "reports" SET "last_activity_at" = COALESCE("published_at", "created_at");

CREATE INDEX "reports_status_last_activity_at_idx" ON "reports"("status", "last_activity_at");

-- Reportes ya resueltos: se asumen cerrados a mano
UPDATE "reports" SET "closed_reason" = 'manual', "closed_at" = "updated_at" WHERE "status" = 'resolved';
