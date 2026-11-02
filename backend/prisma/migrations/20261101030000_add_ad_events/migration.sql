-- CreateEnum
CREATE TYPE "ad_event_type" AS ENUM ('impression', 'click');

-- CreateEnum
CREATE TYPE "ad_placement" AS ENUM ('feed', 'report_detail');

-- CreateTable
CREATE TABLE "ad_events" (
    "id" SERIAL NOT NULL,
    "ad_id" INTEGER NOT NULL,
    "type" "ad_event_type" NOT NULL,
    "placement" "ad_placement" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_events_ad_id_created_at_idx" ON "ad_events"("ad_id", "created_at");

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
