-- AlterEnum
ALTER TYPE "auth_token_type" ADD VALUE 'two_factor_login';
ALTER TYPE "auth_token_type" ADD VALUE 'two_factor_reset';
ALTER TYPE "auth_token_type" ADD VALUE 'two_factor_reset_cancel';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "two_factor_secret_enc" TEXT,
ADD COLUMN     "two_factor_enabled_at" TIMESTAMP(3),
ADD COLUMN     "two_factor_last_step" INTEGER,
ADD COLUMN     "two_factor_failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "two_factor_locked_until" TIMESTAMP(3),
ADD COLUMN     "two_factor_reset_requested_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "two_factor_recovery_codes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_recovery_codes_user_id_code_hash_key" ON "two_factor_recovery_codes"("user_id", "code_hash");

-- AddForeignKey
ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
