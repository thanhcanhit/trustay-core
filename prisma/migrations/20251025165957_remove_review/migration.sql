/*
  Warnings:

  - You are about to drop the `reviews` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_rental_id_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_reviewee_id_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_reviewer_id_fkey";

-- AlterTable
ALTER TABLE "room_bookings" ALTER COLUMN "monthly_rent" DROP NOT NULL,
ALTER COLUMN "deposit_amount" DROP NOT NULL,
ALTER COLUMN "total_amount" DROP NOT NULL;

-- DropTable
DROP TABLE "reviews";

-- DropEnum
DROP TYPE "ReviewerType";
