ALTER TABLE concepts
  ADD COLUMN IF NOT EXISTS concept_data jsonb;
