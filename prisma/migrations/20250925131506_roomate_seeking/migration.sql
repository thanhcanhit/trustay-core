-- CreateEnum
CREATE TYPE "RoommatePostStatus" AS ENUM ('draft', 'pending_approval', 'active', 'paused', 'closed', 'expired');

-- CreateEnum
CREATE TYPE "RoommateApplicationStatus" AS ENUM ('pending', 'approved_by_tenant', 'rejected_by_tenant', 'approved_by_landlord', 'rejected_by_landlord', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "roommate_seeking_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "room_instance_id" TEXT,
    "rental_id" TEXT,
    "external_address" TEXT,
    "external_district_id" INTEGER,
    "external_province_id" INTEGER,
    "external_ward_id" INTEGER,
    "monthly_rent" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "deposit_amount" DECIMAL(15,2) NOT NULL,
    "utility_cost_per_person" DECIMAL(15,2),
    "seeking_count" INTEGER NOT NULL,
    "approved_count" INTEGER NOT NULL DEFAULT 0,
    "remaining_slots" INTEGER NOT NULL,
    "max_occupancy" INTEGER NOT NULL,
    "current_occupancy" INTEGER NOT NULL DEFAULT 1,
    "preferred_gender" "Gender",
    "additional_requirements" TEXT,
    "available_from_date" DATE NOT NULL,
    "minimum_stay_months" INTEGER NOT NULL DEFAULT 1,
    "maximum_stay_months" INTEGER,
    "status" "RoommatePostStatus" NOT NULL DEFAULT 'draft',
    "requires_landlord_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_approved_by_landlord" BOOLEAN,
    "landlord_notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "contact_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roommate_seeking_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roommate_applications" (
    "id" TEXT NOT NULL,
    "roommate_seeking_post_id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "occupation" TEXT,
    "phone_number" TEXT NOT NULL,
    "move_in_date" DATE NOT NULL,
    "intended_stay_months" INTEGER,
    "application_message" TEXT,
    "status" "RoommateApplicationStatus" NOT NULL DEFAULT 'pending',
    "tenant_response" TEXT,
    "tenant_responded_at" TIMESTAMP(3),
    "landlord_response" TEXT,
    "landlord_responded_at" TIMESTAMP(3),
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roommate_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roommate_seeking_posts_slug_key" ON "roommate_seeking_posts"("slug");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_tenant_id_idx" ON "roommate_seeking_posts"("tenant_id");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_room_instance_id_idx" ON "roommate_seeking_posts"("room_instance_id");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_rental_id_idx" ON "roommate_seeking_posts"("rental_id");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_status_idx" ON "roommate_seeking_posts"("status");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_external_province_id_idx" ON "roommate_seeking_posts"("external_province_id");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_external_district_id_idx" ON "roommate_seeking_posts"("external_district_id");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_monthly_rent_idx" ON "roommate_seeking_posts"("monthly_rent");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_available_from_date_idx" ON "roommate_seeking_posts"("available_from_date");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_expires_at_idx" ON "roommate_seeking_posts"("expires_at");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_remaining_slots_idx" ON "roommate_seeking_posts"("remaining_slots");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_approved_count_idx" ON "roommate_seeking_posts"("approved_count");

-- CreateIndex
CREATE INDEX "roommate_seeking_posts_created_at_idx" ON "roommate_seeking_posts"("created_at");

-- CreateIndex
CREATE INDEX "roommate_applications_roommate_seeking_post_id_idx" ON "roommate_applications"("roommate_seeking_post_id");

-- CreateIndex
CREATE INDEX "roommate_applications_applicant_id_idx" ON "roommate_applications"("applicant_id");

-- CreateIndex
CREATE INDEX "roommate_applications_status_idx" ON "roommate_applications"("status");

-- CreateIndex
CREATE INDEX "roommate_applications_move_in_date_idx" ON "roommate_applications"("move_in_date");

-- CreateIndex
CREATE INDEX "roommate_applications_created_at_idx" ON "roommate_applications"("created_at");

-- AddForeignKey
ALTER TABLE "roommate_seeking_posts" ADD CONSTRAINT "roommate_seeking_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roommate_seeking_posts" ADD CONSTRAINT "roommate_seeking_posts_room_instance_id_fkey" FOREIGN KEY ("room_instance_id") REFERENCES "room_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roommate_seeking_posts" ADD CONSTRAINT "roommate_seeking_posts_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roommate_seeking_posts" ADD CONSTRAINT "roommate_seeking_posts_external_province_id_fkey" FOREIGN KEY ("external_province_id") REFERENCES "provinces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roommate_seeking_posts" ADD CONSTRAINT "roommate_seeking_posts_external_district_id_fkey" FOREIGN KEY ("external_district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roommate_seeking_posts" ADD CONSTRAINT "roommate_seeking_posts_external_ward_id_fkey" FOREIGN KEY ("external_ward_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roommate_applications" ADD CONSTRAINT "roommate_applications_roommate_seeking_post_id_fkey" FOREIGN KEY ("roommate_seeking_post_id") REFERENCES "roommate_seeking_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roommate_applications" ADD CONSTRAINT "roommate_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
