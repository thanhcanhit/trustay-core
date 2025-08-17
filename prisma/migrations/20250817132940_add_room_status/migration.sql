/*
  Warnings:

  - You are about to drop the column `is_occupied` on the `room_instances` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('available', 'occupied', 'maintenance', 'reserved', 'unavailable');

-- DropIndex
DROP INDEX "room_instances_is_occupied_idx";

-- AlterTable
ALTER TABLE "room_instances" DROP COLUMN "is_occupied",
ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'available';

-- CreateIndex
CREATE INDEX "room_instances_status_idx" ON "room_instances"("status");
