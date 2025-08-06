-- Targeted cleanup script - ONLY removes crawled room data
-- Preserves administrative data, reference data, users, and room rules

-- Delete room-related data in correct order (respecting foreign keys)
DELETE FROM "RoomImage";
DELETE FROM "RoomAmenity"; 
DELETE FROM "RoomRule";
DELETE FROM "RoomCost";
DELETE FROM "RoomPricing";
DELETE FROM "Room";
DELETE FROM "Floor";
DELETE FROM "Building";

-- Note: We keep all other data intact:
-- - Administrative data (provinces, districts, wards)  
-- - System reference data (amenities, cost types, room rules)
-- - User accounts
-- - All other system configuration

-- Reset room-related sequences (PostgreSQL)
-- SELECT setval(pg_get_serial_sequence('"Room"', 'id'), 1, false);
-- SELECT setval(pg_get_serial_sequence('"Building"', 'id'), 1, false);  
-- SELECT setval(pg_get_serial_sequence('"Floor"', 'id'), 1, false);