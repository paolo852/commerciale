ALTER TABLE lead_candidates
  ADD COLUMN IF NOT EXISTS pm_id uuid REFERENCES project_managers(id) ON DELETE SET NULL;
