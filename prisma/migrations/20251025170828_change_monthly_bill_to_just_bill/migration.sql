/*
  Warnings:

  - You are about to drop the column `monthly_bill_id` on the `bill_items` table. All the data in the column will be lost.
  - You are about to drop the column `monthly_bill_id` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the `monthly_bills` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `bill_id` to the `bill_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "bill_items" DROP CONSTRAINT "bill_items_monthly_bill_id_fkey";

-- DropForeignKey
ALTER TABLE "monthly_bills" DROP CONSTRAINT "monthly_bills_rental_id_fkey";

-- DropForeignKey
ALTER TABLE "monthly_bills" DROP CONSTRAINT "monthly_bills_room_instance_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_monthly_bill_id_fkey";

-- DropIndex
DROP INDEX "bill_items_monthly_bill_id_idx";

-- DropIndex
DROP INDEX "payments_monthly_bill_id_idx";

-- AlterTable
ALTER TABLE "bill_items" DROP COLUMN "monthly_bill_id",
ADD COLUMN     "bill_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "monthly_bill_id",
ADD COLUMN     "bill_id" TEXT;

-- DropTable
DROP TABLE "monthly_bills";

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "room_instance_id" TEXT NOT NULL,
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

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bills_rental_id_idx" ON "bills"("rental_id");

-- CreateIndex
CREATE INDEX "bills_room_instance_id_idx" ON "bills"("room_instance_id");

-- CreateIndex
CREATE INDEX "bills_status_idx" ON "bills"("status");

-- CreateIndex
CREATE INDEX "bills_due_date_idx" ON "bills"("due_date");

-- CreateIndex
CREATE INDEX "bills_billing_year_billing_month_idx" ON "bills"("billing_year", "billing_month");

-- CreateIndex
CREATE UNIQUE INDEX "bills_rental_id_billing_period_key" ON "bills"("rental_id", "billing_period");

-- CreateIndex
CREATE INDEX "bill_items_bill_id_idx" ON "bill_items"("bill_id");

-- CreateIndex
CREATE INDEX "payments_bill_id_idx" ON "payments"("bill_id");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_room_instance_id_fkey" FOREIGN KEY ("room_instance_id") REFERENCES "room_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
