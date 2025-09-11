/*
  Warnings:

  - You are about to drop the column `room_instance_id` on the `room_invitations` table. All the data in the column will be lost.
  - Added the required column `room_id` to the `room_invitations` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "room_invitations" DROP CONSTRAINT "room_invitations_room_instance_id_fkey";

-- DropIndex
DROP INDEX "room_invitations_room_instance_id_idx";

-- AlterTable
ALTER TABLE "room_invitations" DROP COLUMN "room_instance_id",
ADD COLUMN     "room_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "room_invitations_room_id_idx" ON "room_invitations"("room_id");

-- AddForeignKey
ALTER TABLE "room_invitations" ADD CONSTRAINT "room_invitations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
