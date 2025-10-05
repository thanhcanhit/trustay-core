-- AlterTable
ALTER TABLE "room_invitations" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "final_confirmed_at" TIMESTAMP(3),
ADD COLUMN     "is_confirmed_by_sender" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_final_confirmed_by_sender" BOOLEAN NOT NULL DEFAULT false;
