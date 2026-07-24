-- v36: ruolo dell'offerta nel consorzio (leader / invitato)
-- Aggiunge il campo partner_role alle offerte.
-- 'leader' = coordinatore/capofila del progetto
-- 'invited' = partner invitato da un altro coordinatore
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS partner_role TEXT DEFAULT 'leader'
  CHECK (partner_role IN ('leader', 'invited'));
