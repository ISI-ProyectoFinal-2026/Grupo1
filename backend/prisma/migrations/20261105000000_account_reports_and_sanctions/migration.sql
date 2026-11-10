-- CreateEnum
CREATE TYPE "account_report_severity" AS ENUM ('mild', 'moderate', 'severe');

-- CreateEnum
CREATE TYPE "account_sanction_kind" AS ENUM ('temporary', 'provisional', 'permanent');

-- CreateEnum
CREATE TYPE "account_sanction_status" AS ENUM ('active', 'pending_review', 'expired', 'reverted', 'dismissed');

-- CreateEnum
CREATE TYPE "account_sanction_event_type" AS ENUM ('created', 'confirmed', 'reverted', 'dismissed', 'expired');

-- CreateTable
CREATE TABLE "account_reports" (
    "id" SERIAL NOT NULL,
    "reported_user_id" INTEGER NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "severity" "account_report_severity" NOT NULL,
    "sanction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_sanctions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "severity" "account_report_severity" NOT NULL,
    "kind" "account_sanction_kind" NOT NULL,
    "status" "account_sanction_status" NOT NULL,
    "warning" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "triggering_report_ids" INTEGER[],
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_sanction_events" (
    "id" SERIAL NOT NULL,
    "sanction_id" INTEGER NOT NULL,
    "actor_id" INTEGER,
    "type" "account_sanction_event_type" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_sanction_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_reports_reported_user_id_sanction_id_idx" ON "account_reports"("reported_user_id", "sanction_id");

-- CreateIndex
CREATE INDEX "account_sanctions_user_id_status_idx" ON "account_sanctions"("user_id", "status");

-- CreateIndex
CREATE INDEX "account_sanctions_status_ends_at_idx" ON "account_sanctions"("status", "ends_at");

-- CreateIndex
CREATE INDEX "account_sanction_events_sanction_id_idx" ON "account_sanction_events"("sanction_id");

-- AddForeignKey
ALTER TABLE "account_reports" ADD CONSTRAINT "account_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_reports" ADD CONSTRAINT "account_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_reports" ADD CONSTRAINT "account_reports_sanction_id_fkey" FOREIGN KEY ("sanction_id") REFERENCES "account_sanctions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_sanctions" ADD CONSTRAINT "account_sanctions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_sanction_events" ADD CONSTRAINT "account_sanction_events_sanction_id_fkey" FOREIGN KEY ("sanction_id") REFERENCES "account_sanctions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_sanction_events" ADD CONSTRAINT "account_sanction_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique: one report per reporter and account within the open cycle
CREATE UNIQUE INDEX "account_reports_open_cycle_uq" ON "account_reports"("reported_user_id", "reporter_id") WHERE "sanction_id" IS NULL;

-- Partial unique: one open sanction per account
CREATE UNIQUE INDEX "account_sanctions_one_open_uq" ON "account_sanctions"("user_id") WHERE "status" IN ('active', 'pending_review');
