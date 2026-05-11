-- ============================================================
-- Migrazione v9: allegati negli aggiornamenti dei lead
-- ============================================================

-- 1. Colonne di allegato su lead_updates
ALTER TABLE lead_updates
  ADD COLUMN IF NOT EXISTS attachment_url  text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- 2. Bucket per i file allegati agli aggiornamenti
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-update-files', 'lead-update-files', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policy storage (drop idempotente + recreate)
DROP POLICY IF EXISTS "lead-update-files: insert allowed" ON storage.objects;
DROP POLICY IF EXISTS "lead-update-files: select allowed" ON storage.objects;
DROP POLICY IF EXISTS "lead-update-files: delete allowed" ON storage.objects;

CREATE POLICY "lead-update-files: insert allowed" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'lead-update-files' AND (SELECT is_allowed_user()));

CREATE POLICY "lead-update-files: select allowed" ON storage.objects
  FOR SELECT USING (bucket_id = 'lead-update-files' AND (SELECT is_allowed_user()));

CREATE POLICY "lead-update-files: delete allowed" ON storage.objects
  FOR DELETE USING (bucket_id = 'lead-update-files' AND (SELECT is_allowed_user()));
