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
SCHEMA (PostgreSQL) - Tables, Columns, PK/FK, Relationships

users(id PK, email, phone, password_hash, first_name, last_name, role, created_at, updated_at)

buildings(id PK, slug, owner_id FK->users.id, name, address_line_1, address_line_2, district_id FK->districts.id, province_id FK->provinces.id, latitude, longitude, is_active, created_at, updated_at)

rooms(id PK, slug, building_id FK->buildings.id, floor_number, name, description, room_type, area_sqm, max_occupancy, total_rooms, view_count, is_active, created_at, updated_at)

room_instances(id PK, room_id FK->rooms.id, room_number, status, is_active, created_at, updated_at)

rentals(id PK, room_instance_id FK->room_instances.id, tenant_id FK->users.id, owner_id FK->users.id, contract_start_date, contract_end_date, monthly_rent, deposit_paid, status, created_at, updated_at)

bills(id PK, rental_id FK->rentals.id, room_instance_id FK->room_instances.id, billing_period, billing_month, billing_year, period_start, period_end, subtotal, discount_amount, tax_amount, total_amount, status, due_date, created_at, updated_at)

bill_items(id PK, bill_id FK->bills.id, item_type, item_name, description, quantity, unit_price, amount, currency, created_at)

payments(id PK, rental_id FK->rentals.id, bill_id FK->bills.id, payer_id FK->users.id, payment_type, amount, currency, payment_method, payment_status, payment_date, created_at, updated_at)

room_bookings(id PK, room_id FK->rooms.id, tenant_id FK->users.id, move_in_date, move_out_date, rental_months, monthly_rent, deposit_amount, status, created_at, updated_at)

room_invitations(id PK, room_id FK->rooms.id, sender_id FK->users.id, recipient_id FK->users.id, monthly_rent, deposit_amount, move_in_date, rental_months, status, created_at, updated_at)

notifications(id PK, user_id FK->users.id, notification_type, title, message, data, is_read, read_at, expires_at, created_at)

room_images(id PK, room_id FK->rooms.id, image_url, alt_text, sort_order, is_primary, created_at)

room_amenities(id PK, room_id FK->rooms.id, amenity_id FK->amenities.id, custom_value, notes, created_at)

room_costs(id PK, room_id FK->rooms.id, cost_type_template_id FK->cost_type_templates.id, cost_type, currency, fixed_amount, per_person_amount, unit_price, unit, meter_reading, last_meter_reading, billing_cycle, included_in_rent, is_optional, notes, created_at, updated_at)

room_pricing(id PK, room_id FK->rooms.id, base_price_monthly, currency, deposit_amount, deposit_months, utility_included, utility_cost_monthly, cleaning_fee, service_fee_percentage, minimum_stay_months, maximum_stay_months, price_negotiable, created_at, updated_at)

room_rules(id PK, room_id FK->rooms.id, rule_template_id FK->room_rule_templates.id, custom_value, is_enforced, notes, created_at)

amenities(id PK, name, name_en, category, description, is_active, sort_order, created_at, updated_at)

cost_type_templates(id PK, name, name_en, category, default_unit, description, is_active, sort_order, created_at, updated_at)

room_rule_templates(id PK, name, name_en, category, rule_type, description, is_active, sort_order, created_at, updated_at)

provinces(id PK, province_code, province_name, province_name_en, created_at, updated_at)

districts(id PK, district_code, district_name, district_name_en, province_id FK->provinces.id, created_at, updated_at)

wards(id PK, ward_code, ward_name, ward_name_en, ward_level, district_id FK->districts.id, created_at, updated_at)

RELATIONSHIPS (FK):
- buildings.owner_id -> users.id
- rooms.building_id -> buildings.id
- room_instances.room_id -> rooms.id
- rentals.room_instance_id -> room_instances.id; rentals.tenant_id -> users.id; rentals.owner_id -> users.id
- bills.rental_id -> rentals.id; bills.room_instance_id -> room_instances.id
- bill_items.bill_id -> bills.id
- payments.rental_id -> rentals.id; payments.bill_id -> bills.id; payments.payer_id -> users.id
- room_bookings.room_id -> rooms.id; room_bookings.tenant_id -> users.id
- room_invitations.room_id -> rooms.id; room_invitations.sender_id -> users.id; room_invitations.recipient_id -> users.id
- notifications.user_id -> users.id
- room_images.room_id -> rooms.id
- room_amenities.room_id -> rooms.id; room_amenities.amenity_id -> amenities.id
- room_costs.room_id -> rooms.id; room_costs.cost_type_template_id -> cost_type_templates.id
- room_pricing.room_id -> rooms.id
- room_rules.room_id -> rooms.id; room_rules.rule_template_id -> room_rule_templates.id
- districts.province_id -> provinces.id
- wards.district_id -> districts.id
	`;
	}
}
