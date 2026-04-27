-- ============================================================
-- Migrazione v3: tabella leads + lead_files + bucket storage
-- Idempotente: può essere rieseguito senza errori.
-- ============================================================

-- 1. Tabella leads
CREATE TABLE IF NOT EXISTS leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               text NOT NULL,
  pi                 text,
  ente               text,
  description        text,
  status             text NOT NULL DEFAULT 'in_valutazione'
                     CHECK (status IN ('in_valutazione', 'promosso', 'rifiutato')),
  notes              text,
  promoted_offer_id  uuid REFERENCES offers(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status);

-- 2. Tabella lead_files
CREATE TABLE IF NOT EXISTS lead_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  filename      text NOT NULL,
  storage_path  text NOT NULL,
  size          bigint NOT NULL DEFAULT 0,
  mime_type     text,
  uploaded_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_files_lead_id ON lead_files(lead_id);

-- 3. RLS leads
ALTER TABLE leads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads: select allowed" ON leads;
DROP POLICY IF EXISTS "leads: insert allowed" ON leads;
DROP POLICY IF EXISTS "leads: update allowed" ON leads;
DROP POLICY IF EXISTS "leads: delete allowed" ON leads;

CREATE POLICY "leads: select allowed" ON leads
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "leads: insert allowed" ON leads
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "leads: update allowed" ON leads
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "leads: delete allowed" ON leads
  FOR DELETE USING (is_allowed_user());

DROP POLICY IF EXISTS "lf: select allowed" ON lead_files;
DROP POLICY IF EXISTS "lf: insert allowed" ON lead_files;
DROP POLICY IF EXISTS "lf: delete allowed" ON lead_files;

CREATE POLICY "lf: select allowed" ON lead_files
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "lf: insert allowed" ON lead_files
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "lf: delete allowed" ON lead_files
  FOR DELETE USING (is_allowed_user());

-- 4. Storage bucket per i file dei lead (privato)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-files', 'lead-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policies sullo storage bucket
DROP POLICY IF EXISTS "lead-files: select allowed" ON storage.objects;
DROP POLICY IF EXISTS "lead-files: insert allowed" ON storage.objects;
DROP POLICY IF EXISTS "lead-files: delete allowed" ON storage.objects;

CREATE POLICY "lead-files: select allowed" ON storage.objects
  FOR SELECT USING (bucket_id = 'lead-files' AND is_allowed_user());
CREATE POLICY "lead-files: insert allowed" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'lead-files' AND is_allowed_user());
CREATE POLICY "lead-files: delete allowed" ON storage.objects
  FOR DELETE USING (bucket_id = 'lead-files' AND is_allowed_user());
