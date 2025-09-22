-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "overall_rating" DECIMAL(3,2) DEFAULT 0,
ADD COLUMN     "total_ratings" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "overall_rating" DECIMAL(3,2) DEFAULT 0,
ADD COLUMN     "total_ratings" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "overall_rating" DECIMAL(3,2) DEFAULT 0,
ADD COLUMN     "total_ratings" INTEGER NOT NULL DEFAULT 0;
