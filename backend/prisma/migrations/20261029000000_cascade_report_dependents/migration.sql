-- DropForeignKey
ALTER TABLE "report_embeddings" DROP CONSTRAINT "report_embeddings_report_id_fkey";

-- DropForeignKey
ALTER TABLE "report_matches" DROP CONSTRAINT "report_matches_report_lost_id_fkey";

-- DropForeignKey
ALTER TABLE "report_matches" DROP CONSTRAINT "report_matches_report_found_id_fkey";

-- DropForeignKey
ALTER TABLE "report_flags" DROP CONSTRAINT "report_flags_report_id_fkey";

-- AddForeignKey
ALTER TABLE "report_embeddings" ADD CONSTRAINT "report_embeddings_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_matches" ADD CONSTRAINT "report_matches_report_lost_id_fkey" FOREIGN KEY ("report_lost_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_matches" ADD CONSTRAINT "report_matches_report_found_id_fkey" FOREIGN KEY ("report_found_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_flags" ADD CONSTRAINT "report_flags_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
