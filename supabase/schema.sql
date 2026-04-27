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
  probability integer NOT NULL DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
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
  probability          integer NOT NULL DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  project_manager_id   uuid REFERENCES project_managers(id) ON DELETE SET NULL,
  pi                   text,          -- principal investigator
  ente                 text,          -- ente di riferimento
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
-- Tabella allowed_users (registro utenti autorizzati)
-- ============================================================
CREATE TABLE allowed_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Funzione helper: verifica se l'utente corrente è nel registro
-- SECURITY DEFINER = bypassa RLS sulla tabella allowed_users
CREATE OR REPLACE FUNCTION is_allowed_user()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM allowed_users WHERE lower(email) = lower(auth.email())
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

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
ALTER TABLE allowed_users    ENABLE ROW LEVEL SECURITY;

-- Policies offers: tutti gli utenti autorizzati vedono e modificano tutti i dati
CREATE POLICY "offers: select allowed" ON offers
  FOR SELECT USING (is_allowed_user());

CREATE POLICY "offers: insert allowed" ON offers
  FOR INSERT WITH CHECK (is_allowed_user());

CREATE POLICY "offers: update allowed" ON offers
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());

CREATE POLICY "offers: delete allowed" ON offers
  FOR DELETE USING (is_allowed_user());

-- Policies project_managers
CREATE POLICY "pm: select allowed" ON project_managers
  FOR SELECT USING (is_allowed_user());

CREATE POLICY "pm: insert allowed" ON project_managers
  FOR INSERT WITH CHECK (is_allowed_user());

CREATE POLICY "pm: update allowed" ON project_managers
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());

CREATE POLICY "pm: delete allowed" ON project_managers
  FOR DELETE USING (is_allowed_user());

-- Policies funding_calls
CREATE POLICY "fc: select allowed" ON funding_calls
  FOR SELECT USING (is_allowed_user());

CREATE POLICY "fc: insert allowed" ON funding_calls
  FOR INSERT WITH CHECK (is_allowed_user());

CREATE POLICY "fc: update allowed" ON funding_calls
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());

CREATE POLICY "fc: delete allowed" ON funding_calls
  FOR DELETE USING (is_allowed_user());

-- Policies allowed_users: lettura per tutti gli autenticati, scrittura solo per utenti autorizzati
CREATE POLICY "au: select authenticated" ON allowed_users
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "au: insert allowed" ON allowed_users
  FOR INSERT WITH CHECK (is_allowed_user());

CREATE POLICY "au: delete allowed" ON allowed_users
  FOR DELETE USING (is_allowed_user());

-- ============================================================
-- Migrations (da eseguire SOLO se lo schema è già stato applicato)
-- ============================================================
-- ALTER TABLE offers ADD COLUMN IF NOT EXISTS
--   probability integer NOT NULL DEFAULT 50 CHECK (probability >= 0 AND probability <= 100);
-- ALTER TABLE offers ADD COLUMN IF NOT EXISTS pi text;
-- ALTER TABLE offers ADD COLUMN IF NOT EXISTS ente text;
-- ALTER TABLE funding_calls ADD COLUMN IF NOT EXISTS
--   probability integer NOT NULL DEFAULT 50 CHECK (probability >= 0 AND probability <= 100);
