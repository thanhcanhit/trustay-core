-- AlterTable
ALTER TABLE "room_invitations" ADD COLUMN     "room_seeking_post_id" TEXT;

-- CreateIndex
CREATE INDEX "room_invitations_room_seeking_post_id_idx" ON "room_invitations"("room_seeking_post_id");

-- AddForeignKey
ALTER TABLE "room_invitations" ADD CONSTRAINT "room_invitations_room_seeking_post_id_fkey" FOREIGN KEY ("room_seeking_post_id") REFERENCES "room_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
