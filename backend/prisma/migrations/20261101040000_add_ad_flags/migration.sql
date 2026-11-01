-- CreateEnum
CREATE TYPE "ad_flag_status" AS ENUM ('pending', 'removed', 'dismissed');

-- CreateTable
CREATE TABLE "ad_flags" (
    "id" SERIAL NOT NULL,
    "ad_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ad_flag_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_flags_status_idx" ON "ad_flags"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ad_flags_ad_id_user_id_key" ON "ad_flags"("ad_id", "user_id");

-- AddForeignKey
ALTER TABLE "ad_flags" ADD CONSTRAINT "ad_flags_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_flags" ADD CONSTRAINT "ad_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
