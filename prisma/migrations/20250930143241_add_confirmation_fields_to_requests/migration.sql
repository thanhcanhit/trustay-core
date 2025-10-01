/*
  Warnings:

  - You are about to drop the column `confirmed_at` on the `booking_requests` table. All the data in the column will be lost.
  - You are about to drop the column `is_confirmed_by_tenant` on the `booking_requests` table. All the data in the column will be lost.
  - You are about to drop the column `confirmed_at` on the `room_invitations` table. All the data in the column will be lost.
  - You are about to drop the column `is_confirmed_by_sender` on the `room_invitations` table. All the data in the column will be lost.
  - You are about to drop the column `confirmed_at` on the `roommate_applications` table. All the data in the column will be lost.
  - You are about to drop the column `is_confirmed_by_applicant` on the `roommate_applications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "booking_requests" DROP COLUMN "confirmed_at",
DROP COLUMN "is_confirmed_by_tenant";

-- AlterTable
ALTER TABLE "room_invitations" DROP COLUMN "confirmed_at",
DROP COLUMN "is_confirmed_by_sender";

-- AlterTable
ALTER TABLE "roommate_applications" DROP COLUMN "confirmed_at",
DROP COLUMN "is_confirmed_by_applicant";
