-- v39: team di lavoro delle offerte
-- Analogo a concept_assignees ma con ruolo strutturato.
-- Ruoli:
--   'responsabile' — responsabile dell'offerta (uno per offerta, non enforced in DB)
--   'membro'       — team member
--   'fundraising'  — referente fundraising

CREATE TABLE IF NOT EXISTS offer_assignees (
  offer_id            uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  project_manager_id  uuid NOT NULL REFERENCES project_managers(id) ON DELETE CASCADE,
  role                text NOT NULL DEFAULT 'membro'
                      CHECK (role IN ('responsabile', 'membro', 'fundraising')),
  added_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, project_manager_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_assignees_pm ON offer_assignees(project_manager_id);

ALTER TABLE offer_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage offer assignees"
  ON offer_assignees FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());
