-- CreateEnum
CREATE TYPE "location_consent_status" AS ENUM ('accepted', 'declined');

-- CreateEnum
CREATE TYPE "nearby_report_filter" AS ENUM ('lost', 'found', 'both');

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" INTEGER NOT NULL,
    "notify_match" BOOLEAN NOT NULL DEFAULT true,
    "notify_message" BOOLEAN NOT NULL DEFAULT true,
    "notify_status_change" BOOLEAN NOT NULL DEFAULT true,
    "notify_nearby" BOOLEAN NOT NULL DEFAULT true,
    "nearby_radius_km" INTEGER NOT NULL DEFAULT 5,
    "nearby_report_type" "nearby_report_filter" NOT NULL DEFAULT 'both',
    "location_consent_status" "location_consent_status",
    "location_consent_at" TIMESTAMP(3),
    "location" geometry(Point, 4326),
    "location_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex (spatial — GIST, matches PostGIS convention for geometry columns)
CREATE INDEX "notification_preferences_location_idx" ON "notification_preferences" USING GIST ("location");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
