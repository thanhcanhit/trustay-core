/*
  Warnings:

  - You are about to drop the column `preferred_city` on the `room_requests` table. All the data in the column will be lost.
  - You are about to drop the column `preferred_district` on the `room_requests` table. All the data in the column will be lost.
  - You are about to drop the column `preferred_ward` on the `room_requests` table. All the data in the column will be lost.
  - You are about to drop the `room_request_amenities` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `preferred_province_id` to the `room_requests` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "room_request_amenities" DROP CONSTRAINT "room_request_amenities_room_request_id_fkey";

-- DropForeignKey
ALTER TABLE "room_request_amenities" DROP CONSTRAINT "room_request_amenities_system_amenity_id_fkey";

-- DropIndex
DROP INDEX "room_requests_preferred_city_idx";

-- AlterTable
ALTER TABLE "room_requests" DROP COLUMN "preferred_city",
DROP COLUMN "preferred_district",
DROP COLUMN "preferred_ward",
ADD COLUMN     "preferred_district_id" INTEGER,
ADD COLUMN     "preferred_province_id" INTEGER NOT NULL,
ADD COLUMN     "preferred_ward_id" INTEGER;

-- DropTable
DROP TABLE "room_request_amenities";

-- CreateTable
CREATE TABLE "_RoomSeekingPostToSystemAmenity" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoomSeekingPostToSystemAmenity_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RoomSeekingPostToSystemAmenity_B_index" ON "_RoomSeekingPostToSystemAmenity"("B");

-- CreateIndex
CREATE INDEX "room_requests_preferred_province_id_idx" ON "room_requests"("preferred_province_id");

-- CreateIndex
CREATE INDEX "room_requests_preferred_district_id_idx" ON "room_requests"("preferred_district_id");

-- CreateIndex
CREATE INDEX "room_requests_preferred_ward_id_idx" ON "room_requests"("preferred_ward_id");

-- AddForeignKey
ALTER TABLE "room_requests" ADD CONSTRAINT "room_requests_preferred_province_id_fkey" FOREIGN KEY ("preferred_province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_requests" ADD CONSTRAINT "room_requests_preferred_district_id_fkey" FOREIGN KEY ("preferred_district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_requests" ADD CONSTRAINT "room_requests_preferred_ward_id_fkey" FOREIGN KEY ("preferred_ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomSeekingPostToSystemAmenity" ADD CONSTRAINT "_RoomSeekingPostToSystemAmenity_A_fkey" FOREIGN KEY ("A") REFERENCES "room_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomSeekingPostToSystemAmenity" ADD CONSTRAINT "_RoomSeekingPostToSystemAmenity_B_fkey" FOREIGN KEY ("B") REFERENCES "system_amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
