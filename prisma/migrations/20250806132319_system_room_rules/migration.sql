/*
  Warnings:

  - You are about to drop the column `rule_text` on the `room_rules` table. All the data in the column will be lost.
  - You are about to drop the column `rule_type` on the `room_rules` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[room_id,system_rule_id]` on the table `room_rules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `system_rule_id` to the `room_rules` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RuleCategory" AS ENUM ('smoking', 'pets', 'visitors', 'noise', 'cleanliness', 'security', 'usage', 'other');

-- AlterTable
ALTER TABLE "room_rules" DROP COLUMN "rule_text",
DROP COLUMN "rule_type",
ADD COLUMN     "custom_value" TEXT,
ADD COLUMN     "is_enforced" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "system_rule_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "system_room_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" "RuleCategory" NOT NULL,
    "rule_type" TEXT NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_room_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_room_rules_name_en_key" ON "system_room_rules"("name_en");

-- CreateIndex
CREATE INDEX "system_room_rules_category_idx" ON "system_room_rules"("category");

-- CreateIndex
CREATE INDEX "system_room_rules_is_active_idx" ON "system_room_rules"("is_active");

-- CreateIndex
CREATE INDEX "room_rules_room_id_idx" ON "room_rules"("room_id");

-- CreateIndex
CREATE INDEX "room_rules_system_rule_id_idx" ON "room_rules"("system_rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_rules_room_id_system_rule_id_key" ON "room_rules"("room_id", "system_rule_id");

-- AddForeignKey
ALTER TABLE "room_rules" ADD CONSTRAINT "room_rules_system_rule_id_fkey" FOREIGN KEY ("system_rule_id") REFERENCES "system_room_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
