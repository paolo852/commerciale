-- ============================================================
-- Migrazione v6: descrizione e URL sorgente per i bandi
-- Idempotente: può essere rieseguita senza errori.
-- ============================================================

ALTER TABLE funding_calls
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS source_url  text;
