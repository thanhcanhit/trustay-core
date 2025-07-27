/*
  Warnings:

  - The `ward_id` column on the `buildings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `districts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `districts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `provinces` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `provinces` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `ward_id` column on the `user_addresses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `wards` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `wards` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `district_id` on the `buildings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `province_id` on the `buildings` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `province_id` on the `districts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `district_id` on the `user_addresses` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `province_id` on the `user_addresses` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `district_id` on the `wards` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "buildings" DROP CONSTRAINT "buildings_district_id_fkey";

-- DropForeignKey
ALTER TABLE "buildings" DROP CONSTRAINT "buildings_province_id_fkey";

-- DropForeignKey
ALTER TABLE "buildings" DROP CONSTRAINT "buildings_ward_id_fkey";

-- DropForeignKey
ALTER TABLE "districts" DROP CONSTRAINT "districts_province_id_fkey";

-- DropForeignKey
ALTER TABLE "user_addresses" DROP CONSTRAINT "user_addresses_district_id_fkey";

-- DropForeignKey
ALTER TABLE "user_addresses" DROP CONSTRAINT "user_addresses_province_id_fkey";

-- DropForeignKey
ALTER TABLE "user_addresses" DROP CONSTRAINT "user_addresses_ward_id_fkey";

-- DropForeignKey
ALTER TABLE "wards" DROP CONSTRAINT "wards_district_id_fkey";

-- AlterTable
ALTER TABLE "buildings" DROP COLUMN "ward_id",
ADD COLUMN     "ward_id" INTEGER,
DROP COLUMN "district_id",
ADD COLUMN     "district_id" INTEGER NOT NULL,
DROP COLUMN "province_id",
ADD COLUMN     "province_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "districts" DROP CONSTRAINT "districts_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "province_id",
ADD COLUMN     "province_id" INTEGER NOT NULL,
ADD CONSTRAINT "districts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "provinces" DROP CONSTRAINT "provinces_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "provinces_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_addresses" DROP COLUMN "ward_id",
ADD COLUMN     "ward_id" INTEGER,
DROP COLUMN "district_id",
ADD COLUMN     "district_id" INTEGER NOT NULL,
DROP COLUMN "province_id",
ADD COLUMN     "province_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "wards" DROP CONSTRAINT "wards_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "district_id",
ADD COLUMN     "district_id" INTEGER NOT NULL,
ADD CONSTRAINT "wards_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "buildings_district_id_province_id_idx" ON "buildings"("district_id", "province_id");

-- CreateIndex
CREATE INDEX "buildings_district_id_idx" ON "buildings"("district_id");

-- CreateIndex
CREATE INDEX "buildings_province_id_idx" ON "buildings"("province_id");

-- CreateIndex
CREATE INDEX "buildings_ward_id_idx" ON "buildings"("ward_id");

-- CreateIndex
CREATE INDEX "districts_province_id_idx" ON "districts"("province_id");

-- CreateIndex
CREATE INDEX "user_addresses_district_id_idx" ON "user_addresses"("district_id");

-- CreateIndex
CREATE INDEX "user_addresses_province_id_idx" ON "user_addresses"("province_id");

-- CreateIndex
CREATE INDEX "user_addresses_ward_id_idx" ON "user_addresses"("ward_id");

-- CreateIndex
CREATE INDEX "wards_district_id_idx" ON "wards"("district_id");

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
