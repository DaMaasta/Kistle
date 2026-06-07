-- ═══════════════════════════════════════════════════════════════════════════
-- Kistle — PostgreSQL Schema (direkt, kein Supabase)
-- Ausführen: psql -h 192.168.0.100 -U admin -d webapp -f schema.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUM Types ──────────────────────────────────────────────────────────────

CREATE TYPE user_role    AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE space_type   AS ENUM ('room', 'cabinet', 'shelf', 'box', 'fridge', 'other');
CREATE TYPE product_unit AS ENUM ('Stück', 'kg', 'g', 'L', 'ml', 'Packung', 'Flasche', 'Dose', 'Paar', 'Box');
CREATE TYPE booking_type AS ENUM ('booking', 'return');

-- ─── USERS ───────────────────────────────────────────────────────────────────

CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL DEFAULT '',
  password_hash TEXT,                          -- NULL bei Google-Login
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SPACES ──────────────────────────────────────────────────────────────────

CREATE TABLE public.spaces (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  type         space_type NOT NULL DEFAULT 'other',
  parent_id    UUID REFERENCES public.spaces(id) ON DELETE SET NULL,
  owner_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  icon         TEXT NOT NULL DEFAULT '📦',
  color        TEXT NOT NULL DEFAULT '#3b82f6',
  is_group     BOOLEAN NOT NULL DEFAULT FALSE,
  access_code  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.space_members (
  space_id      UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  role          user_role NOT NULL DEFAULT 'editor',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (space_id, user_id)
);

-- ─── PRODUCTS ─────────────────────────────────────────────────────────────────

CREATE TABLE public.products (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id               UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  quantity               NUMERIC NOT NULL DEFAULT 0,
  min_quantity           NUMERIC,
  unit                   product_unit NOT NULL DEFAULT 'Stück',
  category               TEXT NOT NULL DEFAULT '',
  barcode                TEXT,
  image_url              TEXT,
  color                  TEXT,
  last_modified_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  last_modified_by_email TEXT NOT NULL DEFAULT '',
  last_modified_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── BOOKINGS ─────────────────────────────────────────────────────────────────

CREATE TABLE public.bookings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_display_name   TEXT NOT NULL DEFAULT '',
  user_email          TEXT NOT NULL DEFAULT '',
  type                booking_type NOT NULL DEFAULT 'booking',
  original_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  is_returned         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.booking_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id   UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity     NUMERIC NOT NULL,
  unit         TEXT NOT NULL,
  image_url    TEXT,
  box_id       UUID REFERENCES public.spaces(id) ON DELETE SET NULL,
  box_name     TEXT NOT NULL DEFAULT '',
  parent_id    UUID REFERENCES public.spaces(id) ON DELETE SET NULL,
  parent_name  TEXT NOT NULL DEFAULT ''
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

CREATE TABLE public.notifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL DEFAULT 'booking',
  message           TEXT NOT NULL DEFAULT '',
  booking_user_name TEXT NOT NULL DEFAULT '',
  group_id          UUID REFERENCES public.spaces(id) ON DELETE SET NULL,
  group_name        TEXT NOT NULL DEFAULT '',
  read              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── DOKUMENTE ───────────────────────────────────────────────────────────────

CREATE TABLE public.folders (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.files (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  folder_id   UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  mime_type   TEXT NOT NULL DEFAULT 'application/octet-stream',
  size        BIGINT NOT NULL DEFAULT 0,
  storage_ref TEXT NOT NULL,
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDIZES ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_spaces_owner       ON public.spaces(owner_id);
CREATE INDEX idx_spaces_parent      ON public.spaces(parent_id);
CREATE INDEX idx_space_members_user ON public.space_members(user_id);
CREATE INDEX idx_products_space     ON public.products(space_id);
CREATE INDEX idx_bookings_user      ON public.bookings(user_id);
CREATE INDEX idx_notif_user         ON public.notifications(target_user_id);
CREATE INDEX idx_folders_owner      ON public.folders(owner_id);
CREATE INDEX idx_files_folder       ON public.files(folder_id);

-- ─── Trigger: updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER spaces_updated_at  BEFORE UPDATE ON public.spaces  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at   BEFORE UPDATE ON public.users   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
