# Schema Enhancement for Flexible Cost Management

## Vấn đề hiện tại:
- `RoomCost` chỉ có `baseRate` (giá cố định)
- Không hỗ trợ các cách tính chi phí linh hoạt
- Người dùng không thể gắn giá trị cụ thể cho từng loại chi phí

## Đề xuất mở rộng `RoomCost` model:

```prisma
model RoomCost {
  id               String   @id @default(uuid())
  roomId           String   @map("room_id")
  systemCostTypeId String   @map("system_cost_type_id")
  
  // Flexible pricing fields
  costType         CostType @default(fixed) @map("cost_type")
  baseRate         Decimal? @map("base_rate") @db.Decimal(15, 2)
  unitPrice        Decimal? @map("unit_price") @db.Decimal(15, 2)
  fixedAmount      Decimal? @map("fixed_amount") @db.Decimal(15, 2)
  
  // Additional pricing info
  currency         String   @default("VND")
  unit             String?  // Override default unit from SystemCostType
  minimumCharge    Decimal? @map("minimum_charge") @db.Decimal(15, 2)
  maximumCharge    Decimal? @map("maximum_charge") @db.Decimal(15, 2)
  
  // Usage tracking (for metered costs)
  isMetered        Boolean  @default(false) @map("is_metered")
  meterReading     Decimal? @map("meter_reading") @db.Decimal(15, 2)
  lastMeterReading Decimal? @map("last_meter_reading") @db.Decimal(15, 2)
  
  // Billing configuration
  billingCycle     BillingCycle @default(monthly) @map("billing_cycle")
  includedInRent   Boolean  @default(false) @map("included_in_rent")
  isOptional       Boolean  @default(false) @map("is_optional")
  
  notes            String?
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  // Relations
  room           Room           @relation(fields: [roomId], references: [id], onDelete: Cascade)
  systemCostType SystemCostType @relation(fields: [systemCostTypeId], references: [id], onDelete: Cascade)

  @@unique([roomId, systemCostTypeId])
  @@index([roomId])
  @@index([isActive])
  @@map("room_costs")
}

// New enums
enum CostType {
  fixed      // Giá cố định hàng tháng
  per_unit   // Theo đơn vị (kWh, m³)
  metered    // Theo đồng hồ
  percentage // Theo phần trăm
  tiered     // Bậc thang (khác nhau theo mức sử dụng)
}

enum BillingCycle {
  daily
  weekly
  monthly
  quarterly
  yearly
  per_use
}
```

## Ví dụ sử dụng:

### 1. Điện theo đồng hồ:
```json
{
  "systemCostTypeId": "electricity_id",
  "costType": "per_unit",
  "unitPrice": 3500,
  "unit": "kWh",
  "isMetered": true,
  "billingCycle": "monthly"
}
```

### 2. Nước cố định:
```json
{
  "systemCostTypeId": "water_id", 
  "costType": "fixed",
  "fixedAmount": 100000,
  "billingCycle": "monthly",
  "includedInRent": false
}
```

### 3. Internet bao gồm trong tiền thuê:
```json
{
  "systemCostTypeId": "internet_id",
  "costType": "fixed", 
  "fixedAmount": 200000,
  "billingCycle": "monthly",
  "includedInRent": true
}
```

### 4. Phí dọn dẹp theo lần:
```json
{
  "systemCostTypeId": "cleaning_id",
  "costType": "per_unit",
  "unitPrice": 150000,
  "unit": "lần", 
  "billingCycle": "per_use",
  "isOptional": true
}
```

## API Updates needed:

### RoomCost DTO:
```typescript
export interface RoomCostDto {
  id: string;
  systemCostType: SystemCostTypeDto;
  costType: 'fixed' | 'per_unit' | 'metered' | 'percentage' | 'tiered';
  baseRate?: string;
  unitPrice?: string;
  fixedAmount?: string;
  currency: string;
  unit?: string;
  minimumCharge?: string;
  maximumCharge?: string;
  isMetered: boolean;
  billingCycle: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'per_use';
  includedInRent: boolean;
  isOptional: boolean;
  notes?: string;
}
```

## Migration script cần thiết:
```sql
-- Add new columns
ALTER TABLE room_costs ADD COLUMN cost_type TEXT DEFAULT 'fixed';
ALTER TABLE room_costs ADD COLUMN unit_price DECIMAL(15,2);
ALTER TABLE room_costs ADD COLUMN fixed_amount DECIMAL(15,2);
ALTER TABLE room_costs ADD COLUMN unit TEXT;
ALTER TABLE room_costs ADD COLUMN minimum_charge DECIMAL(15,2);
ALTER TABLE room_costs ADD COLUMN maximum_charge DECIMAL(15,2);
ALTER TABLE room_costs ADD COLUMN is_metered BOOLEAN DEFAULT false;
ALTER TABLE room_costs ADD COLUMN meter_reading DECIMAL(15,2);
ALTER TABLE room_costs ADD COLUMN last_meter_reading DECIMAL(15,2);
ALTER TABLE room_costs ADD COLUMN billing_cycle TEXT DEFAULT 'monthly';
ALTER TABLE room_costs ADD COLUMN included_in_rent BOOLEAN DEFAULT false;
ALTER TABLE room_costs ADD COLUMN is_optional BOOLEAN DEFAULT false;

-- Migrate existing data
UPDATE room_costs SET 
  cost_type = 'fixed',
  fixed_amount = base_rate,
  billing_cycle = 'monthly'
WHERE base_rate IS NOT NULL;
``` 

## Lợi ích:
1. ✅ Hỗ trợ nhiều cách tính chi phí
2. ✅ Linh hoạt theo đồng hồ điện/nước
3. ✅ Chi phí tùy chọn (dọn dẹp, giặt ủi)
4. ✅ Chi phí bao gồm trong tiền thuê
5. ✅ Chu kỳ thanh toán linh hoạt
6. ✅ Giới hạn tối thiểu/tối đa