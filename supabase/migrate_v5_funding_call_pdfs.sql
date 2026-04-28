-- ============================================================
-- Migrazione v5: PDF allegati ai bandi di finanziamento
-- Idempotente: può essere rieseguita senza errori.
-- ============================================================

-- Aggiungi colonne PDF alla tabella funding_calls
ALTER TABLE funding_calls
  ADD COLUMN IF NOT EXISTS pdf_path     text,
  ADD COLUMN IF NOT EXISTS pdf_filename text;

-- Bucket storage per i PDF dei bandi (privato)
INSERT INTO storage.buckets (id, name, public)
VALUES ('funding-call-files', 'funding-call-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policy storage: lettura (solo utenti ammessi)
DROP POLICY IF EXISTS "fcf: select allowed" ON storage.objects;
CREATE POLICY "fcf: select allowed" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'funding-call-files' AND is_allowed_user()
  );

-- Policy storage: inserimento
DROP POLICY IF EXISTS "fcf: insert allowed" ON storage.objects;
CREATE POLICY "fcf: insert allowed" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'funding-call-files' AND is_allowed_user()
  );

-- Policy storage: eliminazione
DROP POLICY IF EXISTS "fcf: delete allowed" ON storage.objects;
CREATE POLICY "fcf: delete allowed" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'funding-call-files' AND is_allowed_user()
  );
