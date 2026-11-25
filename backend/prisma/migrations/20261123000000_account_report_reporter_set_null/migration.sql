-- baja propia de cuentas (#366): las denuncias que hizo la cuenta eliminada se conservan sin autor

-- DropForeignKey
ALTER TABLE "account_reports" DROP CONSTRAINT "account_reports_reporter_id_fkey";

-- AlterTable
ALTER TABLE "account_reports" ALTER COLUMN "reporter_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "account_reports" ADD CONSTRAINT "account_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
