-- PRO se elimina (ADR-0024): ningún flujo lo asignaba, pasa a FREE
UPDATE "businesses" SET "plan" = 'FREE', "plan_expires_at" = NULL WHERE "plan" = 'PRO';

-- AlterEnum
ALTER TYPE "business_plan" RENAME TO "business_plan_old";
CREATE TYPE "business_plan" AS ENUM ('FREE', 'PREMIUM');
ALTER TABLE "businesses" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "businesses" ALTER COLUMN "plan" TYPE "business_plan" USING ("plan"::text::"business_plan");
ALTER TABLE "businesses" ALTER COLUMN "plan" SET DEFAULT 'FREE';
DROP TYPE "business_plan_old";

-- CreateEnum
CREATE TYPE "subscription_period" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "period" "subscription_period" NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_business_id_idx" ON "subscriptions"("business_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
