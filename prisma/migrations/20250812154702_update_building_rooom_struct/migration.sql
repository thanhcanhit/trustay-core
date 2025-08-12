/*
  Warnings:

  - You are about to drop the column `room_id` on the `booking_requests` table. All the data in the column will be lost.
  - You are about to drop the column `room_id` on the `monthly_bills` table. All the data in the column will be lost.
  - You are about to drop the column `room_id` on the `rentals` table. All the data in the column will be lost.
  - You are about to drop the column `room_id` on the `room_invitations` table. All the data in the column will be lost.
  - You are about to drop the column `floor_id` on the `rooms` table. All the data in the column will be lost.
  - You are about to drop the column `room_number` on the `rooms` table. All the data in the column will be lost.
  - You are about to drop the `floors` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `room_instance_id` to the `booking_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `room_instance_id` to the `monthly_bills` table without a default value. This is not possible if the table is not empty.
  - Added the required column `room_instance_id` to the `rentals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `room_instance_id` to the `room_invitations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `building_id` to the `rooms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_rooms` to the `rooms` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `rooms` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "booking_requests" DROP CONSTRAINT "booking_requests_room_id_fkey";

-- DropForeignKey
ALTER TABLE "floors" DROP CONSTRAINT "floors_building_id_fkey";

-- DropForeignKey
ALTER TABLE "monthly_bills" DROP CONSTRAINT "monthly_bills_room_id_fkey";

-- DropForeignKey
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_room_id_fkey";

-- DropForeignKey
ALTER TABLE "room_invitations" DROP CONSTRAINT "room_invitations_room_id_fkey";

-- DropForeignKey
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_floor_id_fkey";

-- DropIndex
DROP INDEX "booking_requests_room_id_idx";

-- DropIndex
DROP INDEX "monthly_bills_room_id_idx";

-- DropIndex
DROP INDEX "rentals_room_id_idx";

-- DropIndex
DROP INDEX "room_invitations_room_id_idx";

-- DropIndex
DROP INDEX "rooms_floor_id_idx";

-- DropIndex
DROP INDEX "rooms_floor_id_room_number_key";

-- AlterTable
ALTER TABLE "booking_requests" DROP COLUMN "room_id",
ADD COLUMN     "room_instance_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "monthly_bills" DROP COLUMN "room_id",
ADD COLUMN     "room_instance_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "rentals" DROP COLUMN "room_id",
ADD COLUMN     "room_instance_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "room_invitations" DROP COLUMN "room_id",
ADD COLUMN     "room_instance_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "rooms" DROP COLUMN "floor_id",
DROP COLUMN "room_number",
ADD COLUMN     "building_id" TEXT NOT NULL,
ADD COLUMN     "floor_number" INTEGER,
ADD COLUMN     "total_rooms" INTEGER NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

-- DropTable
DROP TABLE "floors";

-- CreateTable
CREATE TABLE "room_instances" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "room_number" TEXT NOT NULL,
    "is_occupied" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_instances_room_id_idx" ON "room_instances"("room_id");

-- CreateIndex
CREATE INDEX "room_instances_is_occupied_idx" ON "room_instances"("is_occupied");

-- CreateIndex
CREATE INDEX "room_instances_is_active_idx" ON "room_instances"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "room_instances_room_id_room_number_key" ON "room_instances"("room_id", "room_number");

-- CreateIndex
CREATE INDEX "booking_requests_room_instance_id_idx" ON "booking_requests"("room_instance_id");

-- CreateIndex
CREATE INDEX "monthly_bills_room_instance_id_idx" ON "monthly_bills"("room_instance_id");

-- CreateIndex
CREATE INDEX "rentals_room_instance_id_idx" ON "rentals"("room_instance_id");

-- CreateIndex
CREATE INDEX "room_images_room_id_idx" ON "room_images"("room_id");

-- CreateIndex
CREATE INDEX "room_invitations_room_instance_id_idx" ON "room_invitations"("room_instance_id");

-- CreateIndex
CREATE INDEX "rooms_building_id_idx" ON "rooms"("building_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_instances" ADD CONSTRAINT "room_instances_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invitations" ADD CONSTRAINT "room_invitations_room_instance_id_fkey" FOREIGN KEY ("room_instance_id") REFERENCES "room_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_room_instance_id_fkey" FOREIGN KEY ("room_instance_id") REFERENCES "room_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_room_instance_id_fkey" FOREIGN KEY ("room_instance_id") REFERENCES "room_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_bills" ADD CONSTRAINT "monthly_bills_room_instance_id_fkey" FOREIGN KEY ("room_instance_id") REFERENCES "room_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
