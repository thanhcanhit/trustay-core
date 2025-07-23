-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('tenant', 'landlord', 'both');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('single', 'double', 'suite', 'dormitory');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('active', 'terminated', 'expired', 'pending_renewal');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('draft', 'pending', 'paid', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('rent', 'deposit', 'utility', 'fee', 'refund');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('bank_transfer', 'cash', 'e_wallet', 'card');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "ReviewerType" AS ENUM ('tenant', 'owner');

-- CreateEnum
CREATE TYPE "AmenityCategory" AS ENUM ('basic', 'kitchen', 'bathroom', 'entertainment', 'safety', 'connectivity', 'building');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('utility', 'service', 'parking', 'maintenance');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('anyoneCanFind', 'anyoneWithLink', 'domainCanFind', 'domainWithLink', 'limited');

-- CreateEnum
CREATE TYPE "SearchPostStatus" AS ENUM ('active', 'paused', 'closed', 'expired');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "date_of_birth" DATE,
    "gender" "Gender",
    "role" "UserRole" NOT NULL DEFAULT 'tenant',
    "bio" TEXT,
    "id_card_number" TEXT,
    "id_card_images" TEXT[],
    "bank_account" TEXT,
    "bank_name" TEXT,
    "is_verified_phone" BOOLEAN NOT NULL DEFAULT false,
    "is_verified_email" BOOLEAN NOT NULL DEFAULT false,
    "is_verified_identity" BOOLEAN NOT NULL DEFAULT false,
    "is_verified_bank" BOOLEAN NOT NULL DEFAULT false,
    "last_active_at" TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "ward" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Vietnam',
    "postal_code" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "ward" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Vietnam',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "building_id" TEXT NOT NULL,
    "floor_number" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "floor_id" TEXT NOT NULL,
    "room_number" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "room_type" "RoomType" NOT NULL,
    "area_sqm" DECIMAL(8,2),
    "max_occupancy" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_images" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "alt_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_rules" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "rule_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_amenities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" "AmenityCategory" NOT NULL,
    "icon_url" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_amenities" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "system_amenity_id" TEXT NOT NULL,
    "custom_value" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_cost_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "default_unit" TEXT,
    "icon_url" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_cost_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_costs" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "system_cost_type_id" TEXT NOT NULL,
    "base_rate" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_pricing" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "base_price_monthly" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "deposit_amount" DECIMAL(15,2) NOT NULL,
    "deposit_months" INTEGER NOT NULL DEFAULT 1,
    "utility_included" BOOLEAN NOT NULL DEFAULT false,
    "utility_cost_monthly" DECIMAL(15,2),
    "cleaning_fee" DECIMAL(15,2),
    "service_fee_percentage" DECIMAL(5,2),
    "minimum_stay_months" INTEGER NOT NULL DEFAULT 1,
    "maximum_stay_months" INTEGER,
    "price_negotiable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_invitations" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT,
    "recipient_email" TEXT,
    "monthly_rent" DECIMAL(15,2) NOT NULL,
    "deposit_amount" DECIMAL(15,2) NOT NULL,
    "move_in_date" DATE,
    "rental_months" INTEGER,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "expires_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_requests" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "move_in_date" DATE NOT NULL,
    "move_out_date" DATE,
    "rental_months" INTEGER,
    "monthly_rent" DECIMAL(15,2) NOT NULL,
    "deposit_amount" DECIMAL(15,2) NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "message_to_owner" TEXT,
    "owner_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentals" (
    "id" TEXT NOT NULL,
    "booking_request_id" TEXT,
    "invitation_id" TEXT,
    "room_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "contract_start_date" DATE NOT NULL,
    "contract_end_date" DATE,
    "monthly_rent" DECIMAL(15,2) NOT NULL,
    "deposit_paid" DECIMAL(15,2) NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'active',
    "contract_document_url" TEXT,
    "termination_notice_date" DATE,
    "termination_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_bills" (
    "id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "billing_period" TEXT NOT NULL,
    "billing_month" INTEGER NOT NULL,
    "billing_year" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(15,2) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'draft',
    "due_date" DATE NOT NULL,
    "paid_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_items" (
    "id" TEXT NOT NULL,
    "monthly_bill_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(10,2),
    "unit_price" DECIMAL(15,2),
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "monthly_bill_id" TEXT,
    "payer_id" TEXT NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "payment_method" "PaymentMethod",
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_date" TIMESTAMP(3),
    "due_date" DATE,
    "description" TEXT,
    "transaction_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "reviewee_id" TEXT NOT NULL,
    "reviewer_type" "ReviewerType" NOT NULL,
    "property_rating" INTEGER,
    "communication_rating" INTEGER,
    "cleanliness_rating" INTEGER,
    "overall_rating" INTEGER,
    "review_text" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "response_text" TEXT,
    "response_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_search_posts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "preferred_districts" TEXT[],
    "preferred_wards" TEXT[],
    "preferred_city" TEXT NOT NULL,
    "min_budget" DECIMAL(15,2),
    "max_budget" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "preferred_room_types" "RoomType"[],
    "max_occupancy" INTEGER,
    "min_area_sqm" DECIMAL(8,2),
    "move_in_date" DATE,
    "rental_duration" INTEGER,
    "required_amenities" TEXT[],
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "status" "SearchPostStatus" NOT NULL DEFAULT 'active',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "contact_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_search_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_slug_key" ON "buildings"("slug");

-- CreateIndex
CREATE INDEX "buildings_owner_id_idx" ON "buildings"("owner_id");

-- CreateIndex
CREATE INDEX "buildings_district_city_idx" ON "buildings"("district", "city");

-- CreateIndex
CREATE INDEX "buildings_is_active_idx" ON "buildings"("is_active");

-- CreateIndex
CREATE INDEX "buildings_slug_idx" ON "buildings"("slug");

-- CreateIndex
CREATE INDEX "floors_building_id_idx" ON "floors"("building_id");

-- CreateIndex
CREATE UNIQUE INDEX "floors_building_id_floor_number_key" ON "floors"("building_id", "floor_number");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_slug_key" ON "rooms"("slug");

-- CreateIndex
CREATE INDEX "rooms_floor_id_idx" ON "rooms"("floor_id");

-- CreateIndex
CREATE INDEX "rooms_room_type_idx" ON "rooms"("room_type");

-- CreateIndex
CREATE INDEX "rooms_is_active_idx" ON "rooms"("is_active");

-- CreateIndex
CREATE INDEX "rooms_slug_idx" ON "rooms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_floor_id_room_number_key" ON "rooms"("floor_id", "room_number");

-- CreateIndex
CREATE UNIQUE INDEX "system_amenities_name_en_key" ON "system_amenities"("name_en");

-- CreateIndex
CREATE INDEX "system_amenities_category_idx" ON "system_amenities"("category");

-- CreateIndex
CREATE INDEX "system_amenities_is_active_idx" ON "system_amenities"("is_active");

-- CreateIndex
CREATE INDEX "room_amenities_room_id_idx" ON "room_amenities"("room_id");

-- CreateIndex
CREATE INDEX "room_amenities_system_amenity_id_idx" ON "room_amenities"("system_amenity_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_amenities_room_id_system_amenity_id_key" ON "room_amenities"("room_id", "system_amenity_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_cost_types_name_en_key" ON "system_cost_types"("name_en");

-- CreateIndex
CREATE INDEX "system_cost_types_category_idx" ON "system_cost_types"("category");

-- CreateIndex
CREATE INDEX "system_cost_types_is_active_idx" ON "system_cost_types"("is_active");

-- CreateIndex
CREATE INDEX "room_costs_room_id_idx" ON "room_costs"("room_id");

-- CreateIndex
CREATE INDEX "room_costs_is_active_idx" ON "room_costs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "room_costs_room_id_system_cost_type_id_key" ON "room_costs"("room_id", "system_cost_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_pricing_room_id_key" ON "room_pricing"("room_id");

-- CreateIndex
CREATE INDEX "room_invitations_room_id_idx" ON "room_invitations"("room_id");

-- CreateIndex
CREATE INDEX "room_invitations_sender_id_idx" ON "room_invitations"("sender_id");

-- CreateIndex
CREATE INDEX "room_invitations_recipient_id_idx" ON "room_invitations"("recipient_id");

-- CreateIndex
CREATE INDEX "room_invitations_status_idx" ON "room_invitations"("status");

-- CreateIndex
CREATE INDEX "room_invitations_expires_at_idx" ON "room_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "booking_requests_room_id_idx" ON "booking_requests"("room_id");

-- CreateIndex
CREATE INDEX "booking_requests_tenant_id_idx" ON "booking_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "booking_requests_status_idx" ON "booking_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rentals_booking_request_id_key" ON "rentals"("booking_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "rentals_invitation_id_key" ON "rentals"("invitation_id");

-- CreateIndex
CREATE INDEX "rentals_room_id_idx" ON "rentals"("room_id");

-- CreateIndex
CREATE INDEX "rentals_tenant_id_idx" ON "rentals"("tenant_id");

-- CreateIndex
CREATE INDEX "rentals_status_idx" ON "rentals"("status");

-- CreateIndex
CREATE INDEX "monthly_bills_rental_id_idx" ON "monthly_bills"("rental_id");

-- CreateIndex
CREATE INDEX "monthly_bills_room_id_idx" ON "monthly_bills"("room_id");

-- CreateIndex
CREATE INDEX "monthly_bills_status_idx" ON "monthly_bills"("status");

-- CreateIndex
CREATE INDEX "monthly_bills_due_date_idx" ON "monthly_bills"("due_date");

-- CreateIndex
CREATE INDEX "monthly_bills_billing_year_billing_month_idx" ON "monthly_bills"("billing_year", "billing_month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_bills_rental_id_billing_period_key" ON "monthly_bills"("rental_id", "billing_period");

-- CreateIndex
CREATE INDEX "bill_items_monthly_bill_id_idx" ON "bill_items"("monthly_bill_id");

-- CreateIndex
CREATE INDEX "bill_items_item_type_idx" ON "bill_items"("item_type");

-- CreateIndex
CREATE INDEX "payments_rental_id_idx" ON "payments"("rental_id");

-- CreateIndex
CREATE INDEX "payments_monthly_bill_id_idx" ON "payments"("monthly_bill_id");

-- CreateIndex
CREATE INDEX "payments_payer_id_idx" ON "payments"("payer_id");

-- CreateIndex
CREATE INDEX "payments_payment_status_idx" ON "payments"("payment_status");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "reviews_rental_id_idx" ON "reviews"("rental_id");

-- CreateIndex
CREATE INDEX "reviews_reviewee_id_idx" ON "reviews"("reviewee_id");

-- CreateIndex
CREATE INDEX "room_search_posts_tenant_id_idx" ON "room_search_posts"("tenant_id");

-- CreateIndex
CREATE INDEX "room_search_posts_status_idx" ON "room_search_posts"("status");

-- CreateIndex
CREATE INDEX "room_search_posts_preferred_city_idx" ON "room_search_posts"("preferred_city");

-- CreateIndex
CREATE INDEX "room_search_posts_max_budget_idx" ON "room_search_posts"("max_budget");

-- CreateIndex
CREATE INDEX "room_search_posts_move_in_date_idx" ON "room_search_posts"("move_in_date");

-- CreateIndex
CREATE INDEX "room_search_posts_expires_at_idx" ON "room_search_posts"("expires_at");

-- CreateIndex
CREATE INDEX "room_search_posts_created_at_idx" ON "room_search_posts"("created_at");

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_images" ADD CONSTRAINT "room_images_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_rules" ADD CONSTRAINT "room_rules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_amenities" ADD CONSTRAINT "room_amenities_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_amenities" ADD CONSTRAINT "room_amenities_system_amenity_id_fkey" FOREIGN KEY ("system_amenity_id") REFERENCES "system_amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_costs" ADD CONSTRAINT "room_costs_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_costs" ADD CONSTRAINT "room_costs_system_cost_type_id_fkey" FOREIGN KEY ("system_cost_type_id") REFERENCES "system_cost_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_pricing" ADD CONSTRAINT "room_pricing_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invitations" ADD CONSTRAINT "room_invitations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invitations" ADD CONSTRAINT "room_invitations_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_invitations" ADD CONSTRAINT "room_invitations_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_booking_request_id_fkey" FOREIGN KEY ("booking_request_id") REFERENCES "booking_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "room_invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_bills" ADD CONSTRAINT "monthly_bills_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_bills" ADD CONSTRAINT "monthly_bills_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_monthly_bill_id_fkey" FOREIGN KEY ("monthly_bill_id") REFERENCES "monthly_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_monthly_bill_id_fkey" FOREIGN KEY ("monthly_bill_id") REFERENCES "monthly_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_search_posts" ADD CONSTRAINT "room_search_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
