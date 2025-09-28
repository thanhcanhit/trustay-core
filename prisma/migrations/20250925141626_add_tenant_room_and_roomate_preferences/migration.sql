-- CreateTable
CREATE TABLE "tenant_room_preferences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "preferred_province_ids" INTEGER[],
    "preferred_district_ids" INTEGER[],
    "min_budget" DECIMAL(15,2),
    "max_budget" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "preferred_room_types" "RoomType"[],
    "max_occupancy" INTEGER,
    "requires_amenity_ids" TEXT[],
    "available_from_date" DATE,
    "min_lease_term" INTEGER DEFAULT 3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_room_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_roommate_preferences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "preferred_gender" "Gender",
    "preferred_age_min" INTEGER,
    "preferred_age_max" INTEGER,
    "allows_smoking" BOOLEAN NOT NULL DEFAULT false,
    "allows_pets" BOOLEAN NOT NULL DEFAULT false,
    "allows_guests" BOOLEAN NOT NULL DEFAULT true,
    "cleanliness_level" INTEGER,
    "social_interaction_level" INTEGER,
    "deal_breakers" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_roommate_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_room_preferences_tenant_id_key" ON "tenant_room_preferences"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_room_preferences_tenant_id_idx" ON "tenant_room_preferences"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_room_preferences_max_budget_idx" ON "tenant_room_preferences"("max_budget");

-- CreateIndex
CREATE INDEX "tenant_room_preferences_preferred_province_ids_idx" ON "tenant_room_preferences"("preferred_province_ids");

-- CreateIndex
CREATE INDEX "tenant_room_preferences_available_from_date_idx" ON "tenant_room_preferences"("available_from_date");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_roommate_preferences_tenant_id_key" ON "tenant_roommate_preferences"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_roommate_preferences_tenant_id_idx" ON "tenant_roommate_preferences"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_roommate_preferences_preferred_gender_idx" ON "tenant_roommate_preferences"("preferred_gender");

-- CreateIndex
CREATE INDEX "tenant_roommate_preferences_allows_smoking_idx" ON "tenant_roommate_preferences"("allows_smoking");

-- CreateIndex
CREATE INDEX "tenant_roommate_preferences_allows_pets_idx" ON "tenant_roommate_preferences"("allows_pets");

-- AddForeignKey
ALTER TABLE "tenant_room_preferences" ADD CONSTRAINT "tenant_room_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_roommate_preferences" ADD CONSTRAINT "tenant_roommate_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
