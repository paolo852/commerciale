-- v25: direct funding_call link on concepts (optional, for concepts not created via lead)
ALTER TABLE concepts
  ADD COLUMN IF NOT EXISTS funding_call_id uuid REFERENCES funding_calls(id) ON DELETE SET NULL;
