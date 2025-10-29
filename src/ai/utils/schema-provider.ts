/**
 * Database schema provider for AI context
 */
export class SchemaProvider {
	/**
	 * Get complete database schema for AI context
	 * @returns Complete database schema string
	 */
	static getCompleteDatabaseSchema(): string {
		return `
DATABASE SCHEMA - Trustay App (PostgreSQL):

MAIN TABLES:
- users (id, email, phone, password_hash, first_name, last_name, role: tenant|landlord, created_at, updated_at)
- buildings (id, slug, owner_id -> users.id, name, address_line_1, address_line_2, district_id, province_id, latitude, longitude, is_active, created_at, updated_at)
- rooms (id, slug, building_id -> buildings.id, floor_number, name, description, room_type: boarding_house|dormitory|sleepbox|apartment|whole_house, area_sqm, max_occupancy, total_rooms, view_count, is_active, created_at, updated_at)
- room_instances (id, room_id -> rooms.id, room_number, status: available|occupied|maintenance|reserved|unavailable, is_active, created_at, updated_at)
- rentals (id, room_instance_id -> room_instances.id, tenant_id -> users.id, owner_id -> users.id, contract_start_date, contract_end_date, monthly_rent, deposit_paid, status: active|terminated|expired|pending_renewal, created_at, updated_at)
- bills (id, rental_id -> rentals.id, room_instance_id -> room_instances.id, billing_period, billing_month, billing_year, period_start, period_end, subtotal, discount_amount, tax_amount, total_amount, status: draft|pending|paid|overdue|cancelled, due_date, created_at, updated_at)
- bill_items (id, bill_id -> bills.id, item_type, item_name, description, quantity, unit_price, amount, currency, created_at)
- payments (id, rental_id -> rentals.id, bill_id -> bills.id, payer_id -> users.id, payment_type: rent|deposit|utility|fee|refund, amount, currency, payment_method: bank_transfer|cash|e_wallet|card, payment_status: pending|completed|failed|refunded, payment_date, created_at, updated_at)
- room_bookings (id, room_id -> rooms.id, tenant_id -> users.id, move_in_date, move_out_date, rental_months, monthly_rent, deposit_amount, status: pending|accepted|rejected|expired|cancelled|awaiting_confirmation, created_at, updated_at)
- room_invitations (id, room_id -> rooms.id, sender_id -> users.id, recipient_id -> users.id, monthly_rent, deposit_amount, move_in_date, rental_months, status: pending|accepted|rejected|expired|cancelled|awaiting_confirmation, created_at, updated_at)
- notifications (id, user_id -> users.id, notification_type, title, message, data, is_read, read_at, expires_at, created_at)

ROOM DETAILS:
- room_images (id, room_id -> rooms.id, image_url, alt_text, sort_order, is_primary, created_at)
- room_amenities (id, room_id -> rooms.id, amenity_id -> amenities.id, custom_value, notes, created_at)
- room_costs (id, room_id -> rooms.id, cost_type_template_id -> cost_type_templates.id, cost_type: fixed|per_person|metered, currency, fixed_amount, per_person_amount, unit_price, unit, meter_reading, last_meter_reading, billing_cycle, included_in_rent, is_optional, notes, created_at, updated_at)
- room_pricing (id, room_id -> rooms.id, base_price_monthly, currency, deposit_amount, deposit_months, utility_included, utility_cost_monthly, cleaning_fee, service_fee_percentage, minimum_stay_months, maximum_stay_months, price_negotiable, created_at, updated_at)
- room_rules (id, room_id -> rooms.id, rule_template_id -> room_rule_templates.id, custom_value, is_enforced, notes, created_at)

REFERENCE TABLES:
- amenities (id, name, name_en, category: basic|kitchen|bathroom|entertainment|safety|connectivity|building, description, is_active, sort_order, created_at, updated_at)
- cost_type_templates (id, name, name_en, category: utility|service|parking|maintenance, default_unit, description, is_active, sort_order, created_at, updated_at)
- room_rule_templates (id, name, name_en, category: smoking|pets|visitors|noise|cleanliness|security|usage|other, rule_type: allowed|forbidden|required|conditional, description, is_active, sort_order, created_at, updated_at)

LOCATION TABLES:
- provinces (id, province_code, province_name, province_name_en, created_at, updated_at)
- districts (id, district_code, district_name, district_name_en, province_id -> provinces.id, created_at, updated_at)
- wards (id, ward_code, ward_name, ward_name_en, ward_level, district_id -> districts.id, created_at, updated_at)

ENUMS:
- UserRole: tenant, landlord
- RoomType: boarding_house, dormitory, sleepbox, apartment, whole_house
- RoomStatus: available, occupied, maintenance, reserved, unavailable
- RentalStatus: active, terminated, expired, pending_renewal
- BillStatus: draft, pending, paid, overdue, cancelled
- PaymentStatus: pending, completed, failed, refunded
- PaymentType: rent, deposit, utility, fee, refund
- PaymentMethod: bank_transfer, cash, e_wallet, card
- RequestStatus: pending, accepted, rejected, expired, cancelled, awaiting_confirmation
- AmenityCategory: basic, kitchen, bathroom, entertainment, safety, connectivity, building
- CostCategory: utility, service, parking, maintenance
- RuleCategory: smoking, pets, visitors, noise, cleanliness, security, usage, other
- RuleType: allowed, forbidden, required, conditional
- CostType: fixed, per_person, metered
- BillingCycle: daily, weekly, monthly, quarterly, yearly, per_use

IMPORTANT NOTES:
- rooms table does NOT have 'price' column - use room_pricing.base_price_monthly instead
- Use room_instances for specific room instances, rooms for room types
- All foreign key relationships use snake_case column names
- All timestamps are in snake_case (created_at, updated_at)
- Use proper JOIN syntax for related tables
- Always include LIMIT to prevent large result sets
`;
	}
}
