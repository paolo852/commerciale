ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS consulting_call_id uuid REFERENCES funding_calls(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS offers_consulting_call_id_idx ON offers(consulting_call_id);
