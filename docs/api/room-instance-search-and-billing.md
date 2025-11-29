# Room Instance Search & Billing Cheatsheet

## 1. Search Room Instances (Admin Portal)

- **Endpoint:** `GET /rooms/instances/search`
- **Auth:** Landlord (JWT)
- **Query params:**
  - `buildingId` *(optional, UUID)* – restrict search to a specific building.
  - `search` *(optional, string)* – single text input.
    - If the value looks like a UUID, the API tries to match `roomInstanceId`, `roomId`, or `buildingId`.
    - Otherwise it performs case-insensitive partial matches against:
      - Room number (`roomNumber`)
      - Room name (`roomName`)
      - Building name (`buildingName`)
      - Owner name/email/phone (`owner`)
      - Tenant name/email/phone (`tenant` - via active rentals)
      - Address: province/district/ward names
      - Room notes (`notes`)
  - `status` *(optional, enum)* – filter by room status: `available`, `occupied`, `maintenance`, `reserved`, `unavailable`
- **Behavior:** At least one of the parameters must be provided. Returns up to 20 newest matches.

```http
GET /rooms/instances/search?buildingId=b6e8a8f2-8c8c-4b8a-9b8a-7c8b8a8b8a8b&search=ph%C3%B2ng
Authorization: Bearer <token>
```

```json
{
  "success": true,
  "message": "Room instances found",
  "data": [
    {
      "id": "f5c1…",
      "roomNumber": "A101",
      "roomId": "4b35…",
      "roomName": "Phòng VIP",
      "buildingId": "b6e8…",
      "buildingName": "Nhà trọ Minh Phát",
      "ownerId": "32d1…",
      "ownerName": "Nguyễn Văn Minh"
    }
  ],
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## 2. Create Bill by Room Instance

- **Endpoint:** `POST /bills/create-for-room`
- **Auth:** Landlord
- **Body:** `CreateBillForRoomDto`

```json
{
  "roomInstanceId": "f5c1…",
  "billingPeriod": "2025-01",
  "billingMonth": 1,
  "billingYear": 2025,
  "periodStart": "2025-01-01",
  "periodEnd": "2025-01-31",
  "occupancyCount": 2,
  "meterReadings": [
    { "roomCostId": "electric-cost-id", "currentReading": 1500, "lastReading": 1200 },
    { "roomCostId": "water-cost-id", "currentReading": 310, "lastReading": 250 }
  ],
  "notes": "Manual bill for January"
}
```

### Flow
1. Call the search endpoint to identify the correct `roomInstanceId`.
2. Submit the payload above.
3. Service auto-calculates costs, creates bill items, and notifies the tenant (if applicable).

Keep this file close for quick reference when wiring UI calls or Postman collections.

