-- v24: add target_offers to funding_calls
ALTER TABLE funding_calls
  ADD COLUMN IF NOT EXISTS target_offers integer DEFAULT NULL;
