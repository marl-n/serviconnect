-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
