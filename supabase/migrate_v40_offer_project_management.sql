-- v40: gestione progetto per ogni offerta
-- Aggiunge campi liberi all'offerta per Drive/Gmail/note, e tre tabelle
-- per budget tracker, timeline milestone e contatti del progetto.

-- ────────────────────────────────────────────────────────────────
-- Nuovi campi su offers
-- ────────────────────────────────────────────────────────────────

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS drive_url    TEXT,
  ADD COLUMN IF NOT EXISTS gmail_query  TEXT,
  ADD COLUMN IF NOT EXISTS ideas        TEXT;

-- ────────────────────────────────────────────────────────────────
-- offer_budget_items: voci di budget con previsto vs effettivo
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offer_budget_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id        uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  label           text NOT NULL,
  planned_eur     numeric(12, 2) NOT NULL DEFAULT 0,
  actual_eur      numeric(12, 2) NOT NULL DEFAULT 0,
  notes           text,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_budget_items_offer ON offer_budget_items(offer_id);

ALTER TABLE offer_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage offer budget items"
  ON offer_budget_items FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());

-- ────────────────────────────────────────────────────────────────
-- offer_milestones: timeline del progetto
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offer_milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id        uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  label           text NOT NULL,
  due_date        date,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'done')),
  notes           text,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_milestones_offer ON offer_milestones(offer_id);

ALTER TABLE offer_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage offer milestones"
  ON offer_milestones FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());

-- ────────────────────────────────────────────────────────────────
-- offer_contacts: contatti del progetto (PI, partner, funder officer)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS offer_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id        uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  name            text NOT NULL,
  role            text,
  organization    text,
  email           text,
  phone           text,
  notes           text,
  is_primary      boolean NOT NULL DEFAULT false,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_contacts_offer ON offer_contacts(offer_id);

ALTER TABLE offer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage offer contacts"
  ON offer_contacts FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());
