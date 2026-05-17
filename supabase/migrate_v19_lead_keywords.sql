-- v19: add keywords array to lead_candidates
ALTER TABLE lead_candidates
  ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT NULL;
