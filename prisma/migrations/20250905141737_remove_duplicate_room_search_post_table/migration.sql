/*
  Warnings:

  - You are about to drop the `room_search_posts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "room_search_posts" DROP CONSTRAINT "room_search_posts_tenant_id_fkey";

-- DropTable
DROP TABLE "room_search_posts";
