/*
  Warnings:

  - You are about to drop the column `final_confirmed_at` on the `booking_requests` table. All the data in the column will be lost.
  - You are about to drop the column `is_final_confirmed_by_tenant` on the `booking_requests` table. All the data in the column will be lost.
  - You are about to drop the column `final_confirmed_at` on the `room_invitations` table. All the data in the column will be lost.
  - You are about to drop the column `is_final_confirmed_by_sender` on the `room_invitations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "booking_requests" DROP COLUMN "final_confirmed_at",
DROP COLUMN "is_final_confirmed_by_tenant";

-- AlterTable
ALTER TABLE "room_invitations" DROP COLUMN "final_confirmed_at",
DROP COLUMN "is_final_confirmed_by_sender";
