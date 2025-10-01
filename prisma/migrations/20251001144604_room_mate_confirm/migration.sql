-- AlterTable
ALTER TABLE "roommate_applications" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "is_confirmed_by_landlord" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_confirmed_by_tenant" BOOLEAN NOT NULL DEFAULT false;
