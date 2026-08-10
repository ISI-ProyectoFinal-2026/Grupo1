-- CreateIndex
CREATE UNIQUE INDEX "chats_user_a_id_user_b_id_key" ON "chats"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "report_matches_report_found_id_idx" ON "report_matches"("report_found_id");
