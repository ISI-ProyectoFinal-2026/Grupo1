-- CreateEnum
CREATE TYPE "business_category" AS ENUM ('VETERINARIA', 'REFUGIO', 'PET_SHOP', 'OTRO');

-- CreateEnum
CREATE TYPE "business_plan" AS ENUM ('FREE', 'PRO', 'PREMIUM');

-- CreateTable
CREATE TABLE "businesses" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "category" "business_category" NOT NULL,
    "plan" "business_plan" NOT NULL DEFAULT 'FREE',
    "plan_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_user_id_key" ON "businesses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_cuit_key" ON "businesses"("cuit");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
