/*
  Warnings:

  - The `status` column on the `room_bookings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `room_invitations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `roommate_applications` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'cancelled', 'awaiting_confirmation');

-- AlterTable
ALTER TABLE "room_bookings" DROP COLUMN "status",
ADD COLUMN     "status" "RequestStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "room_invitations" DROP COLUMN "status",
ADD COLUMN     "status" "RequestStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "roommate_applications" DROP COLUMN "status",
ADD COLUMN     "status" "RequestStatus" NOT NULL DEFAULT 'pending';

-- DropEnum
DROP TYPE "InvitationStatus";

-- DropEnum
DROP TYPE "RoomBookingStatus";

-- DropEnum
DROP TYPE "RoommateApplicationStatus";

-- CreateIndex
CREATE INDEX "room_bookings_status_idx" ON "room_bookings"("status");

-- CreateIndex
CREATE INDEX "room_invitations_status_idx" ON "room_invitations"("status");

-- CreateIndex
CREATE INDEX "roommate_applications_status_idx" ON "roommate_applications"("status");
