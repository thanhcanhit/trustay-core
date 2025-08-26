-- CreateTable
CREATE TABLE "room_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "preferred_district" TEXT,
    "preferred_ward" TEXT,
    "preferred_city" TEXT NOT NULL,
    "min_budget" DECIMAL(15,2),
    "max_budget" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "preferred_room_type" "RoomType",
    "occupancy" INTEGER,
    "move_in_date" DATE,
    "status" "SearchPostStatus" NOT NULL DEFAULT 'active',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "contact_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_request_amenities" (
    "id" TEXT NOT NULL,
    "room_request_id" TEXT NOT NULL,
    "system_amenity_id" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "custom_value" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_request_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_requests_slug_key" ON "room_requests"("slug");

-- CreateIndex
CREATE INDEX "room_requests_requester_id_idx" ON "room_requests"("requester_id");

-- CreateIndex
CREATE INDEX "room_requests_status_idx" ON "room_requests"("status");

-- CreateIndex
CREATE INDEX "room_requests_preferred_city_idx" ON "room_requests"("preferred_city");

-- CreateIndex
CREATE INDEX "room_requests_max_budget_idx" ON "room_requests"("max_budget");

-- CreateIndex
CREATE INDEX "room_requests_move_in_date_idx" ON "room_requests"("move_in_date");

-- CreateIndex
CREATE INDEX "room_requests_expires_at_idx" ON "room_requests"("expires_at");

-- CreateIndex
CREATE INDEX "room_requests_created_at_idx" ON "room_requests"("created_at");

-- CreateIndex
CREATE INDEX "room_request_amenities_room_request_id_idx" ON "room_request_amenities"("room_request_id");

-- CreateIndex
CREATE INDEX "room_request_amenities_system_amenity_id_idx" ON "room_request_amenities"("system_amenity_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_request_amenities_room_request_id_system_amenity_id_key" ON "room_request_amenities"("room_request_id", "system_amenity_id");

-- AddForeignKey
ALTER TABLE "room_requests" ADD CONSTRAINT "room_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_request_amenities" ADD CONSTRAINT "room_request_amenities_room_request_id_fkey" FOREIGN KEY ("room_request_id") REFERENCES "room_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_request_amenities" ADD CONSTRAINT "room_request_amenities_system_amenity_id_fkey" FOREIGN KEY ("system_amenity_id") REFERENCES "system_amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
