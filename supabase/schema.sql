-- ============================================================
-- Schema offerte commerciali
-- ============================================================

-- Enum tipi offerta
CREATE TYPE offer_type AS ENUM ('financed', 'consulting');

-- Enum stati offerta
CREATE TYPE offer_status AS ENUM ('in_lavorazione', 'presentata', 'ferma');

-- Enum esiti offerta
CREATE TYPE offer_outcome AS ENUM ('nessuno', 'approvato', 'rifiutato');

-- ============================================================
-- Tabella project_managers
-- ============================================================
CREATE TABLE project_managers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Tabella funding_calls
-- ============================================================
CREATE TABLE funding_calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        text NOT NULL,         -- es. "RIA-2024"
  name        text NOT NULL,         -- descrizione estesa
  body        text,                  -- ente erogatore es. "MIMIT"
  deadline    date,                  -- scadenza ultima del bando
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Tabella offers
-- ============================================================
CREATE TABLE offers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  type                 offer_type NOT NULL,
  funding_call         text,          -- solo se type = 'financed'
  client               text,          -- solo se type = 'consulting'
  deadline             date NOT NULL,
  budget               numeric(15, 2) NOT NULL CHECK (budget >= 0),
  project_manager_id   uuid REFERENCES project_managers(id) ON DELETE SET NULL,
  status               offer_status NOT NULL DEFAULT 'in_lavorazione',
  outcome              offer_outcome NOT NULL DEFAULT 'nessuno',
  submitted_at         date,          -- obbligatorio se status = 'presentata'
  decided_at           date,          -- obbligatorio se outcome != 'nessuno'
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),

  -- Vincoli logici
  CONSTRAINT chk_financed_fields
    CHECK (
      (type = 'financed' AND funding_call IS NOT NULL AND client IS NULL) OR
      (type = 'consulting' AND client IS NOT NULL AND funding_call IS NULL)
    ),
  CONSTRAINT chk_submitted_at
    CHECK (status != 'presentata' OR submitted_at IS NOT NULL),
  CONSTRAINT chk_decided_at
    CHECK (outcome = 'nessuno' OR decided_at IS NOT NULL)
);

-- ============================================================
-- Indici
-- ============================================================
CREATE INDEX idx_offers_user_id          ON offers(user_id);
CREATE INDEX idx_offers_status           ON offers(status);
CREATE INDEX idx_offers_outcome          ON offers(outcome);
CREATE INDEX idx_offers_deadline         ON offers(deadline);
CREATE INDEX idx_offers_project_manager  ON offers(project_manager_id);
CREATE INDEX idx_pm_user_id              ON project_managers(user_id);
CREATE INDEX idx_fc_user_id              ON funding_calls(user_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE offers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_calls    ENABLE ROW LEVEL SECURITY;

-- Policies offers
CREATE POLICY "offers: select own" ON offers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "offers: insert own" ON offers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "offers: update own" ON offers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "offers: delete own" ON offers
  FOR DELETE USING (auth.uid() = user_id);

-- Policies project_managers
CREATE POLICY "pm: select own" ON project_managers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "pm: insert own" ON project_managers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pm: update own" ON project_managers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pm: delete own" ON project_managers
  FOR DELETE USING (auth.uid() = user_id);

-- Policies funding_calls
CREATE POLICY "fc: select own" ON funding_calls
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fc: insert own" ON funding_calls
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fc: update own" ON funding_calls
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fc: delete own" ON funding_calls
  FOR DELETE USING (auth.uid() = user_id);
