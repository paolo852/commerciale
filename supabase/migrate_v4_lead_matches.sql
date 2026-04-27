-- ============================================================
-- Migrazione v4: cache risultati AI matching lead ↔ bandi
-- Idempotente: può essere rieseguita senza errori.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  funding_call_id uuid NOT NULL REFERENCES funding_calls(id) ON DELETE CASCADE,
  score           integer NOT NULL CHECK (score >= 0 AND score <= 100),
  rationale       text,
  analyzed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, funding_call_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_matches_lead_id ON lead_matches(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_matches_score   ON lead_matches(score DESC);

ALTER TABLE lead_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lm: select allowed" ON lead_matches;
DROP POLICY IF EXISTS "lm: insert allowed" ON lead_matches;
DROP POLICY IF EXISTS "lm: delete allowed" ON lead_matches;

CREATE POLICY "lm: select allowed" ON lead_matches
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "lm: insert allowed" ON lead_matches
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "lm: delete allowed" ON lead_matches
  FOR DELETE USING (is_allowed_user());
