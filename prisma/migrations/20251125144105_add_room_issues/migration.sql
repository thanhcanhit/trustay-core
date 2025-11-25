/*
  Warnings:

  - The values [per_unit,percentage,tiered] on the enum `CostType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `system_amenity_id` on the `room_amenities` table. All the data in the column will be lost.
  - You are about to drop the column `base_rate` on the `room_costs` table. All the data in the column will be lost.
  - You are about to drop the column `is_metered` on the `room_costs` table. All the data in the column will be lost.
  - You are about to drop the column `maximum_charge` on the `room_costs` table. All the data in the column will be lost.
  - You are about to drop the column `minimum_charge` on the `room_costs` table. All the data in the column will be lost.
  - You are about to drop the column `system_cost_type_id` on the `room_costs` table. All the data in the column will be lost.
  - You are about to drop the column `system_rule_id` on the `room_rules` table. All the data in the column will be lost.
  - You are about to drop the `_RoomSeekingPostToSystemAmenity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `system_amenities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `system_cost_types` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `system_room_rules` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[room_id,amenity_id]` on the table `room_amenities` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[room_id,cost_type_template_id]` on the table `room_costs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[room_id,rule_template_id]` on the table `room_rules` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amenity_id` to the `room_amenities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cost_type_template_id` to the `room_costs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rule_template_id` to the `room_rules` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoomIssueCategory" AS ENUM ('facility', 'utility', 'neighbor', 'noise', 'security', 'other');

-- CreateEnum
CREATE TYPE "RoomIssueStatus" AS ENUM ('new', 'in_progress', 'resolved');

-- AlterEnum
BEGIN;
CREATE TYPE "CostType_new" AS ENUM ('fixed', 'per_person', 'metered');
ALTER TABLE "room_costs" ALTER COLUMN "cost_type" DROP DEFAULT;
ALTER TABLE "room_costs" ALTER COLUMN "cost_type" TYPE "CostType_new" USING ("cost_type"::text::"CostType_new");
ALTER TYPE "CostType" RENAME TO "CostType_old";
ALTER TYPE "CostType_new" RENAME TO "CostType";
DROP TYPE "CostType_old";
ALTER TABLE "room_costs" ALTER COLUMN "cost_type" SET DEFAULT 'fixed';
COMMIT;

-- DropForeignKey
ALTER TABLE "_RoomSeekingPostToSystemAmenity" DROP CONSTRAINT "_RoomSeekingPostToSystemAmenity_A_fkey";

-- DropForeignKey
ALTER TABLE "_RoomSeekingPostToSystemAmenity" DROP CONSTRAINT "_RoomSeekingPostToSystemAmenity_B_fkey";

-- DropForeignKey
ALTER TABLE "room_amenities" DROP CONSTRAINT "room_amenities_system_amenity_id_fkey";

-- DropForeignKey
ALTER TABLE "room_costs" DROP CONSTRAINT "room_costs_system_cost_type_id_fkey";

-- DropForeignKey
ALTER TABLE "room_rules" DROP CONSTRAINT "room_rules_system_rule_id_fkey";

-- DropIndex
DROP INDEX "room_amenities_room_id_system_amenity_id_key";

-- DropIndex
DROP INDEX "room_amenities_system_amenity_id_idx";

-- DropIndex
DROP INDEX "room_costs_room_id_system_cost_type_id_key";

-- DropIndex
DROP INDEX "room_rules_room_id_system_rule_id_key";

-- DropIndex
DROP INDEX "room_rules_system_rule_id_idx";

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "occupancy_count" INTEGER,
ADD COLUMN     "rental_end_date" DATE,
ADD COLUMN     "rental_start_date" DATE,
ADD COLUMN     "requires_meter_data" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "room_amenities" DROP COLUMN "system_amenity_id",
ADD COLUMN     "amenity_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "room_costs" DROP COLUMN "base_rate",
DROP COLUMN "is_metered",
DROP COLUMN "maximum_charge",
DROP COLUMN "minimum_charge",
DROP COLUMN "system_cost_type_id",
ADD COLUMN     "cost_type_template_id" TEXT NOT NULL,
ADD COLUMN     "per_person_amount" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "room_rules" DROP COLUMN "system_rule_id",
ADD COLUMN     "rule_template_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "balance" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "_RoomSeekingPostToSystemAmenity";

-- DropTable
DROP TABLE "system_amenities";

-- DropTable
DROP TABLE "system_cost_types";

-- DropTable
DROP TABLE "system_room_rules";

-- CreateTable
CREATE TABLE "room_rule_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" "RuleCategory" NOT NULL,
    "ruleType" "RuleType" NOT NULL DEFAULT 'allowed',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_rule_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" "AmenityCategory" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_type_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "default_unit" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_type_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_instance_meter_readings" (
    "id" TEXT NOT NULL,
    "room_instance_id" TEXT NOT NULL,
    "room_cost_id" TEXT NOT NULL,
    "meter_reading" DECIMAL(15,2),
    "last_meter_reading" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_instance_meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_issues" (
    "id" TEXT NOT NULL,
    "room_instance_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "RoomIssueCategory" NOT NULL,
    "status" "RoomIssueStatus" NOT NULL DEFAULT 'new',
    "image_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AmenityToRoomSeekingPost" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AmenityToRoomSeekingPost_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_rule_templates_name_en_key" ON "room_rule_templates"("name_en");

-- CreateIndex
CREATE INDEX "room_rule_templates_category_idx" ON "room_rule_templates"("category");

-- CreateIndex
CREATE INDEX "room_rule_templates_is_active_idx" ON "room_rule_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "amenities_name_en_key" ON "amenities"("name_en");

-- CreateIndex
CREATE INDEX "amenities_category_idx" ON "amenities"("category");

-- CreateIndex
CREATE INDEX "amenities_is_active_idx" ON "amenities"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cost_type_templates_name_en_key" ON "cost_type_templates"("name_en");

-- CreateIndex
CREATE INDEX "cost_type_templates_category_idx" ON "cost_type_templates"("category");

-- CreateIndex
CREATE INDEX "cost_type_templates_is_active_idx" ON "cost_type_templates"("is_active");

-- CreateIndex
CREATE INDEX "room_instance_meter_readings_room_instance_id_idx" ON "room_instance_meter_readings"("room_instance_id");

-- CreateIndex
CREATE INDEX "room_instance_meter_readings_room_cost_id_idx" ON "room_instance_meter_readings"("room_cost_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_instance_meter_readings_room_instance_id_room_cost_id_key" ON "room_instance_meter_readings"("room_instance_id", "room_cost_id");

-- CreateIndex
CREATE INDEX "room_issues_room_instance_id_idx" ON "room_issues"("room_instance_id");

-- CreateIndex
CREATE INDEX "room_issues_reporter_id_idx" ON "room_issues"("reporter_id");

-- CreateIndex
CREATE INDEX "room_issues_created_at_idx" ON "room_issues"("created_at");

-- CreateIndex
CREATE INDEX "_AmenityToRoomSeekingPost_B_index" ON "_AmenityToRoomSeekingPost"("B");

-- CreateIndex
CREATE INDEX "room_amenities_amenity_id_idx" ON "room_amenities"("amenity_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_amenities_room_id_amenity_id_key" ON "room_amenities"("room_id", "amenity_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_costs_room_id_cost_type_template_id_key" ON "room_costs"("room_id", "cost_type_template_id");

-- CreateIndex
CREATE INDEX "room_rules_rule_template_id_idx" ON "room_rules"("rule_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_rules_room_id_rule_template_id_key" ON "room_rules"("room_id", "rule_template_id");

-- AddForeignKey
ALTER TABLE "room_rules" ADD CONSTRAINT "room_rules_rule_template_id_fkey" FOREIGN KEY ("rule_template_id") REFERENCES "room_rule_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_amenities" ADD CONSTRAINT "room_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_costs" ADD CONSTRAINT "room_costs_cost_type_template_id_fkey" FOREIGN KEY ("cost_type_template_id") REFERENCES "cost_type_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_instance_meter_readings" ADD CONSTRAINT "room_instance_meter_readings_room_instance_id_fkey" FOREIGN KEY ("room_instance_id") REFERENCES "room_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_instance_meter_readings" ADD CONSTRAINT "room_instance_meter_readings_room_cost_id_fkey" FOREIGN KEY ("room_cost_id") REFERENCES "room_costs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_issues" ADD CONSTRAINT "room_issues_room_instance_id_fkey" FOREIGN KEY ("room_instance_id") REFERENCES "room_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_issues" ADD CONSTRAINT "room_issues_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AmenityToRoomSeekingPost" ADD CONSTRAINT "_AmenityToRoomSeekingPost_A_fkey" FOREIGN KEY ("A") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AmenityToRoomSeekingPost" ADD CONSTRAINT "_AmenityToRoomSeekingPost_B_fkey" FOREIGN KEY ("B") REFERENCES "room_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
