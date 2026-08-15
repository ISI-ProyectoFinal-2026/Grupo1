-- CreateEnum
CREATE TYPE "report_flag_status" AS ENUM ('pending', 'reviewed');

-- CreateTable
CREATE TABLE "report_flags" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "report_flag_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_flags_status_idx" ON "report_flags"("status");

-- CreateIndex
CREATE INDEX "report_flags_report_id_idx" ON "report_flags"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_flags_report_id_user_id_key" ON "report_flags"("report_id", "user_id");

-- AddForeignKey
ALTER TABLE "report_flags" ADD CONSTRAINT "report_flags_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_flags" ADD CONSTRAINT "report_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
