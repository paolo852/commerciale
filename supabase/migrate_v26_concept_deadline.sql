-- v26: closing deadline on concepts
ALTER TABLE concepts
  ADD COLUMN IF NOT EXISTS deadline date DEFAULT NULL;
