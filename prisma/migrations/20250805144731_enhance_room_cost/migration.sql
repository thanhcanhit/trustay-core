-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('fixed', 'per_unit', 'metered', 'percentage', 'tiered');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'per_use');

-- AlterTable
ALTER TABLE "room_costs" ADD COLUMN     "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
ADD COLUMN     "cost_type" "CostType" NOT NULL DEFAULT 'fixed',
ADD COLUMN     "fixed_amount" DECIMAL(15,2),
ADD COLUMN     "included_in_rent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_metered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_optional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_meter_reading" DECIMAL(15,2),
ADD COLUMN     "maximum_charge" DECIMAL(15,2),
ADD COLUMN     "meter_reading" DECIMAL(15,2),
ADD COLUMN     "minimum_charge" DECIMAL(15,2),
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "unit_price" DECIMAL(15,2),
ALTER COLUMN "base_rate" DROP NOT NULL;
