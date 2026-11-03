-- CreateTable
CREATE TABLE "role_change_audits" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "previous_role" "role" NOT NULL,
    "new_role" "role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_change_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_change_audits_created_at_idx" ON "role_change_audits"("created_at");

-- AddForeignKey
ALTER TABLE "role_change_audits" ADD CONSTRAINT "role_change_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_change_audits" ADD CONSTRAINT "role_change_audits_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
