/*
  Warnings:

  - You are about to drop the column `booking_request_id` on the `rentals` table. All the data in the column will be lost.
  - You are about to drop the `booking_requests` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[room_booking_id]` on the table `rentals` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RoomBookingStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- DropForeignKey
ALTER TABLE "booking_requests" DROP CONSTRAINT "booking_requests_room_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_requests" DROP CONSTRAINT "booking_requests_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "rentals" DROP CONSTRAINT "rentals_booking_request_id_fkey";

-- DropIndex
DROP INDEX "rentals_booking_request_id_key";

-- AlterTable
ALTER TABLE "rentals" DROP COLUMN "booking_request_id",
ADD COLUMN     "room_booking_id" TEXT;

-- DropTable
DROP TABLE "booking_requests";

-- DropEnum
DROP TYPE "BookingStatus";

-- CreateTable
CREATE TABLE "room_bookings" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "move_in_date" DATE NOT NULL,
    "move_out_date" DATE,
    "rental_months" INTEGER,
    "monthly_rent" DECIMAL(15,2) NOT NULL,
    "deposit_amount" DECIMAL(15,2) NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "status" "RoomBookingStatus" NOT NULL DEFAULT 'pending',
    "message_to_owner" TEXT,
    "owner_notes" TEXT,
    "is_confirmed_by_tenant" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_bookings_room_id_idx" ON "room_bookings"("room_id");

-- CreateIndex
CREATE INDEX "room_bookings_tenant_id_idx" ON "room_bookings"("tenant_id");

-- CreateIndex
CREATE INDEX "room_bookings_status_idx" ON "room_bookings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rentals_room_booking_id_key" ON "rentals"("room_booking_id");

-- AddForeignKey
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_room_booking_id_fkey" FOREIGN KEY ("room_booking_id") REFERENCES "room_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
