-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('monthly_rental', 'yearly_rental', 'daily_rental');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'pending_signature', 'partially_signed', 'fully_signed', 'active', 'expired', 'terminated');

-- CreateEnum
CREATE TYPE "SignerRole" AS ENUM ('landlord', 'tenant', 'witness');

-- AlterTable
ALTER TABLE "room_requests" ALTER COLUMN "preferred_province_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contract_code" TEXT NOT NULL,
    "rental_id" TEXT,
    "landlord_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "room_instance_id" TEXT NOT NULL,
    "contractType" "ContractType" NOT NULL DEFAULT 'monthly_rental',
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "contract_data" JSONB NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "pdf_url" TEXT,
    "pdf_hash" TEXT,
    "pdf_size" INTEGER,
    "signed_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "legal_metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_signatures" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "signer_id" TEXT NOT NULL,
    "signer_role" "SignerRole" NOT NULL,
    "signature_image" TEXT NOT NULL,
    "signature_hash" TEXT NOT NULL,
    "authentication_method" TEXT NOT NULL,
    "authentication_data" JSONB NOT NULL,
    "signature_metadata" JSONB NOT NULL,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_audit_logs" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "action_details" JSONB NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "session_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_code_key" ON "contracts"("contract_code");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_rental_id_key" ON "contracts"("rental_id");

-- CreateIndex
CREATE INDEX "contracts_status_created_at_idx" ON "contracts"("status", "created_at");

-- CreateIndex
CREATE INDEX "contracts_landlord_id_idx" ON "contracts"("landlord_id");

-- CreateIndex
CREATE INDEX "contracts_tenant_id_idx" ON "contracts"("tenant_id");

-- CreateIndex
CREATE INDEX "contracts_signed_at_idx" ON "contracts"("signed_at");

-- CreateIndex
CREATE INDEX "contract_signatures_contract_id_idx" ON "contract_signatures"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_signatures_contract_id_signer_id_key" ON "contract_signatures"("contract_id", "signer_id");

-- CreateIndex
CREATE INDEX "contract_audit_logs_contract_id_timestamp_idx" ON "contract_audit_logs"("contract_id", "timestamp");

-- CreateIndex
CREATE INDEX "contract_audit_logs_action_idx" ON "contract_audit_logs"("action");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_room_instance_id_fkey" FOREIGN KEY ("room_instance_id") REFERENCES "room_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signatures" ADD CONSTRAINT "contract_signatures_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_audit_logs" ADD CONSTRAINT "contract_audit_logs_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_audit_logs" ADD CONSTRAINT "contract_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
