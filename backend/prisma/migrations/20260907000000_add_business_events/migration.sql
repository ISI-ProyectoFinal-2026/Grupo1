-- CreateEnum
CREATE TYPE "business_event_type" AS ENUM ('VIEW', 'CONTACT');

-- CreateTable
CREATE TABLE "business_events" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "type" "business_event_type" NOT NULL,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_events_business_id_type_idx" ON "business_events"("business_id", "type");

-- AddForeignKey
ALTER TABLE "business_events" ADD CONSTRAINT "business_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_events" ADD CONSTRAINT "business_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
