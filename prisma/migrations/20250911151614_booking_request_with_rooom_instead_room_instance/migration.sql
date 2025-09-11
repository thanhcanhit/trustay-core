/*
  Warnings:

  - You are about to drop the column `room_instance_id` on the `booking_requests` table. All the data in the column will be lost.
  - Added the required column `room_id` to the `booking_requests` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "booking_requests" DROP CONSTRAINT "booking_requests_room_instance_id_fkey";

-- DropIndex
DROP INDEX "booking_requests_room_instance_id_idx";

-- AlterTable
ALTER TABLE "booking_requests" DROP COLUMN "room_instance_id",
ADD COLUMN     "room_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "booking_requests_room_id_idx" ON "booking_requests"("room_id");

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
