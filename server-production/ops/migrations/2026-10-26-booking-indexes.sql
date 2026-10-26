-- Indizes für Verlauf (Filter nach Gruppe) und Rückbuchungen (Summe je Originalbuchung)
CREATE INDEX IF NOT EXISTS idx_booking_parent_spaces_space ON booking_parent_spaces (space_id);
CREATE INDEX IF NOT EXISTS idx_bookings_original ON bookings (original_booking_id) WHERE original_booking_id IS NOT NULL;
