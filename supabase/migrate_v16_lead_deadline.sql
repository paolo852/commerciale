ALTER TABLE funding_calls
  ADD COLUMN IF NOT EXISTS lead_deadline date;
