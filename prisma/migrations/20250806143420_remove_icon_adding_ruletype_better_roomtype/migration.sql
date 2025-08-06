/*
  Warnings:

  - The values [single,double,suite] on the enum `RoomType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `icon_url` on the `system_amenities` table. All the data in the column will be lost.
  - You are about to drop the column `icon_url` on the `system_cost_types` table. All the data in the column will be lost.
  - You are about to drop the column `icon_url` on the `system_room_rules` table. All the data in the column will be lost.
  - You are about to drop the column `rule_type` on the `system_room_rules` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('allowed', 'forbidden', 'required', 'conditional');

-- AlterEnum
BEGIN;
CREATE TYPE "RoomType_new" AS ENUM ('boarding_house', 'dormitory', 'sleepbox', 'apartment', 'whole_house');
ALTER TABLE "rooms" ALTER COLUMN "room_type" TYPE "RoomType_new" USING ("room_type"::text::"RoomType_new");
ALTER TABLE "room_search_posts" ALTER COLUMN "preferred_room_types" TYPE "RoomType_new"[] USING ("preferred_room_types"::text::"RoomType_new"[]);
ALTER TYPE "RoomType" RENAME TO "RoomType_old";
ALTER TYPE "RoomType_new" RENAME TO "RoomType";
DROP TYPE "RoomType_old";
COMMIT;

-- AlterTable
ALTER TABLE "system_amenities" DROP COLUMN "icon_url";

-- AlterTable
ALTER TABLE "system_cost_types" DROP COLUMN "icon_url";

-- AlterTable
ALTER TABLE "system_room_rules" DROP COLUMN "icon_url",
DROP COLUMN "rule_type",
ADD COLUMN     "ruleType" "RuleType" NOT NULL DEFAULT 'allowed';
