-- AlterTable
ALTER TABLE "booking_requests" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "is_confirmed_by_tenant" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "room_invitations" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "is_confirmed_by_sender" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "roommate_applications" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "is_confirmed_by_applicant" BOOLEAN NOT NULL DEFAULT false;
