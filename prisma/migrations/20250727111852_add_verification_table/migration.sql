-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('email', 'phone', 'password_reset');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'verified', 'expired', 'failed');

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "type" "VerificationType" NOT NULL,
    "code" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_codes_email_idx" ON "verification_codes"("email");

-- CreateIndex
CREATE INDEX "verification_codes_phone_idx" ON "verification_codes"("phone");

-- CreateIndex
CREATE INDEX "verification_codes_code_idx" ON "verification_codes"("code");

-- CreateIndex
CREATE INDEX "verification_codes_type_idx" ON "verification_codes"("type");

-- CreateIndex
CREATE INDEX "verification_codes_status_idx" ON "verification_codes"("status");

-- CreateIndex
CREATE INDEX "verification_codes_expires_at_idx" ON "verification_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
