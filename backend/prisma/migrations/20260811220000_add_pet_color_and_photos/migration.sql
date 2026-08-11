-- AlterTable
ALTER TABLE "pets"
  ADD COLUMN "color" TEXT,
  ADD COLUMN "photo_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "pets" ALTER COLUMN "photo_urls" DROP DEFAULT;
