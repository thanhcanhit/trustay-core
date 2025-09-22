-- CreateEnum
CREATE TYPE "RatingTargetType" AS ENUM ('tenant', 'landlord', 'room');

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "target_type" "RatingTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "rental_id" TEXT,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "images" TEXT[],

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ratings_target_type_target_id_idx" ON "ratings"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "ratings_reviewer_id_idx" ON "ratings"("reviewer_id");

-- CreateIndex
CREATE INDEX "ratings_rental_id_idx" ON "ratings"("rental_id");

-- CreateIndex
CREATE INDEX "ratings_rating_idx" ON "ratings"("rating");

-- CreateIndex
CREATE INDEX "ratings_created_at_idx" ON "ratings"("created_at");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
