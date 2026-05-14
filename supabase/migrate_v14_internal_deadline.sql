ALTER TABLE funding_calls
  ADD COLUMN IF NOT EXISTS internal_deadline date;
