-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7);

-- AlterTable
ALTER TABLE "room_search_posts" ADD COLUMN     "preferred_latitude" DECIMAL(10,7),
ADD COLUMN     "preferred_longitude" DECIMAL(10,7),
ADD COLUMN     "search_radius_km" DECIMAL(8,2);

-- CreateTable
CREATE TABLE "provinces" (
    "id" TEXT NOT NULL,
    "province_code" TEXT NOT NULL,
    "province_name" TEXT NOT NULL,
    "province_name_en" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "district_code" TEXT NOT NULL,
    "district_name" TEXT NOT NULL,
    "district_name_en" TEXT,
    "province_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "ward_code" TEXT NOT NULL,
    "ward_name" TEXT NOT NULL,
    "ward_name_en" TEXT,
    "ward_level" TEXT NOT NULL,
    "district_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provinces_province_code_key" ON "provinces"("province_code");

-- CreateIndex
CREATE INDEX "provinces_province_code_idx" ON "provinces"("province_code");

-- CreateIndex
CREATE UNIQUE INDEX "districts_district_code_key" ON "districts"("district_code");

-- CreateIndex
CREATE INDEX "districts_district_code_idx" ON "districts"("district_code");

-- CreateIndex
CREATE INDEX "districts_province_id_idx" ON "districts"("province_id");

-- CreateIndex
CREATE UNIQUE INDEX "wards_ward_code_key" ON "wards"("ward_code");

-- CreateIndex
CREATE INDEX "wards_ward_code_idx" ON "wards"("ward_code");

-- CreateIndex
CREATE INDEX "wards_district_id_idx" ON "wards"("district_id");

-- CreateIndex
CREATE INDEX "buildings_latitude_longitude_idx" ON "buildings"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "room_search_posts_preferred_latitude_preferred_longitude_idx" ON "room_search_posts"("preferred_latitude", "preferred_longitude");

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
