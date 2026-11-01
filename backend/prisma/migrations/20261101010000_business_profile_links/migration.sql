-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "description" TEXT,
ADD COLUMN     "social_links" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "website" TEXT;
