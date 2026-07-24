-- v35: percentuale di completamento del documento di offerta
-- Aggiunge il campo document_progress alle offerte (0-100).
-- Rappresenta quanto è avanzato il documento di offerta, impostato manualmente.
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS document_progress INTEGER DEFAULT 0;
