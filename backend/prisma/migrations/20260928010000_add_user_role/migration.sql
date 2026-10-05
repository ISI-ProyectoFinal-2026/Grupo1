-- CreateEnum
CREATE TYPE "role" AS ENUM ('usuario_regular', 'moderador', 'admin');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "role" NOT NULL DEFAULT 'usuario_regular';
