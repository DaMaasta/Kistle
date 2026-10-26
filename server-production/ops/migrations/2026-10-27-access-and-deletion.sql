-- Rechte, Löschverhalten, Einladungen und Sitzungen
-- Anwenden: docker exec -i postgres psql -v ON_ERROR_STOP=1 -U <user> <db> < diese-datei.sql
BEGIN;

-- Boxen erben die Rolle ihrer Gruppe. Eigene Box-Mitgliedschaften (bisher automatisch
-- "admin" für den Ersteller) hebelten das aus: wer aus der Gruppe entfernt oder
-- herabgestuft wurde, behielt vollen Zugriff auf die selbst angelegten Boxen.
DELETE FROM space_members sm
USING spaces s
WHERE s.id = sm.space_id AND NOT s.is_group;

-- Boxen gehören dem Besitzer ihrer Gruppe (sonst würde das Löschen des Box-Erstellers
-- per ON DELETE CASCADE dessen Boxen in fremden Gruppen mitlöschen)
UPDATE spaces b
SET owner_id = g.owner_id
FROM spaces g
WHERE b.parent_id = g.id AND NOT b.is_group AND b.owner_id <> g.owner_id;

-- Gruppe löschen löscht ihre Boxen mit (vorher: SET NULL verletzte
-- spaces_non_group_needs_parent, das Löschen schlug fehl)
ALTER TABLE spaces DROP CONSTRAINT spaces_parent_id_fkey;
ALTER TABLE spaces ADD CONSTRAINT spaces_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES spaces(id) ON DELETE CASCADE;

-- Konto löschen: Buchungsverlauf und Produkte bleiben erhalten (Name/E-Mail stehen
-- als Kopie in der Buchung), der Verweis auf den Nutzer wird geleert
ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE bookings DROP CONSTRAINT bookings_user_id_fkey;
ALTER TABLE bookings ADD CONSTRAINT bookings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE SET NULL;

ALTER TABLE products ALTER COLUMN last_modified_by DROP NOT NULL;
ALTER TABLE products DROP CONSTRAINT products_last_modified_by_fkey;
ALTER TABLE products ADD CONSTRAINT products_last_modified_by_fkey
  FOREIGN KEY (last_modified_by) REFERENCES users(uid) ON DELETE SET NULL;

-- Einladungslinks enthalten ein Geheimnis statt nur der Gruppen-ID; Admins können es
-- erneuern und damit alte Links ungültig machen
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS invite_token text;
UPDATE spaces
SET invite_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE is_group AND invite_token IS NULL;

-- Passwortwechsel macht ältere Tokens ungültig
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

COMMIT;
