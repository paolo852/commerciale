-- ============================================================
-- Migrazione v2: dati condivisi + registro utenti autorizzati
-- Da eseguire nel SQL Editor di Supabase sul database esistente.
-- Idempotente: può essere rieseguito senza errori.
-- ============================================================

-- 1. Nuove colonne (se non esistono già)
ALTER TABLE offers ADD COLUMN IF NOT EXISTS pi text;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ente text;
ALTER TABLE funding_calls ADD COLUMN IF NOT EXISTS
  probability integer NOT NULL DEFAULT 50 CHECK (probability >= 0 AND probability <= 100);

-- 2. Tabella registro utenti autorizzati
CREATE TABLE IF NOT EXISTS allowed_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Funzione helper (SECURITY DEFINER bypassa RLS su allowed_users)
CREATE OR REPLACE FUNCTION is_allowed_user()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM allowed_users WHERE lower(email) = lower(auth.email())
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. RLS allowed_users
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "au: select authenticated" ON allowed_users;
DROP POLICY IF EXISTS "au: insert allowed"        ON allowed_users;
DROP POLICY IF EXISTS "au: delete allowed"        ON allowed_users;

CREATE POLICY "au: select authenticated" ON allowed_users
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "au: insert allowed" ON allowed_users
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "au: delete allowed" ON allowed_users
  FOR DELETE USING (is_allowed_user());

-- 5. Policy condivise sulle tabelle dati (drop old + new)

-- offers
DROP POLICY IF EXISTS "offers: select own"     ON offers;
DROP POLICY IF EXISTS "offers: insert own"     ON offers;
DROP POLICY IF EXISTS "offers: update own"     ON offers;
DROP POLICY IF EXISTS "offers: delete own"     ON offers;
DROP POLICY IF EXISTS "offers: select allowed" ON offers;
DROP POLICY IF EXISTS "offers: insert allowed" ON offers;
DROP POLICY IF EXISTS "offers: update allowed" ON offers;
DROP POLICY IF EXISTS "offers: delete allowed" ON offers;

CREATE POLICY "offers: select allowed" ON offers
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "offers: insert allowed" ON offers
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "offers: update allowed" ON offers
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "offers: delete allowed" ON offers
  FOR DELETE USING (is_allowed_user());

-- project_managers
DROP POLICY IF EXISTS "pm: select own"     ON project_managers;
DROP POLICY IF EXISTS "pm: insert own"     ON project_managers;
DROP POLICY IF EXISTS "pm: update own"     ON project_managers;
DROP POLICY IF EXISTS "pm: delete own"     ON project_managers;
DROP POLICY IF EXISTS "pm: select allowed" ON project_managers;
DROP POLICY IF EXISTS "pm: insert allowed" ON project_managers;
DROP POLICY IF EXISTS "pm: update allowed" ON project_managers;
DROP POLICY IF EXISTS "pm: delete allowed" ON project_managers;

CREATE POLICY "pm: select allowed" ON project_managers
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "pm: insert allowed" ON project_managers
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "pm: update allowed" ON project_managers
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "pm: delete allowed" ON project_managers
  FOR DELETE USING (is_allowed_user());

-- funding_calls
DROP POLICY IF EXISTS "fc: select own"     ON funding_calls;
DROP POLICY IF EXISTS "fc: insert own"     ON funding_calls;
DROP POLICY IF EXISTS "fc: update own"     ON funding_calls;
DROP POLICY IF EXISTS "fc: delete own"     ON funding_calls;
DROP POLICY IF EXISTS "fc: select allowed" ON funding_calls;
DROP POLICY IF EXISTS "fc: insert allowed" ON funding_calls;
DROP POLICY IF EXISTS "fc: update allowed" ON funding_calls;
DROP POLICY IF EXISTS "fc: delete allowed" ON funding_calls;

CREATE POLICY "fc: select allowed" ON funding_calls
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "fc: insert allowed" ON funding_calls
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "fc: update allowed" ON funding_calls
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "fc: delete allowed" ON funding_calls
  FOR DELETE USING (is_allowed_user());

-- 6. Inserisci il primo utente autorizzato (sostituisci con la tua email)
-- INSERT INTO allowed_users (email, name) VALUES ('tua@email.com', 'Il tuo nome');
