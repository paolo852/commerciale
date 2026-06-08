-- v32: link diretto lead → offerta (per promozione saltando il concept)
ALTER TABLE lead_candidates
  ADD COLUMN IF NOT EXISTS promoted_offer_id UUID REFERENCES offers(id) ON DELETE SET NULL;
