-- CreateEnum
CREATE TYPE "ad_status" AS ENUM ('ACTIVE', 'PAUSED', 'REMOVED');

-- CreateTable
CREATE TABLE "ads" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "radius_km" INTEGER NOT NULL,
    "status" "ad_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ads_business_id_status_idx" ON "ads"("business_id", "status");

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
