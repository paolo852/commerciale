-- ============================================================
-- Migrazione v8: Lead Candidates
-- Nuova sezione pre-concept per tracciare i ricercatori con cui
-- siamo in contatto, raggruppati per tipologia di bando.
-- Idempotente: può essere rieseguita senza errori.
-- ============================================================

-- 1. Tabella lead_candidates
CREATE TABLE IF NOT EXISTS lead_candidates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  researcher_name     text NOT NULL,
  institution         text,
  call_type           text NOT NULL DEFAULT 'Non classificato',
  funding_call_id     uuid REFERENCES funding_calls(id) ON DELETE SET NULL,
  potential_project   text,
  status              text NOT NULL DEFAULT 'attivo'
                      CHECK (status IN ('attivo', 'promosso', 'archiviato')),
  promoted_concept_id uuid REFERENCES concepts(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lc_user    ON lead_candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_lc_status  ON lead_candidates(status);
CREATE INDEX IF NOT EXISTS idx_lc_ctype   ON lead_candidates(call_type);

-- 2. Tabella lead_updates (storico interazioni)
CREATE TABLE IF NOT EXISTS lead_updates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES lead_candidates(id) ON DELETE CASCADE,
  body         text NOT NULL,
  author_id    uuid REFERENCES project_managers(id) ON DELETE SET NULL,
  author_name  text NOT NULL DEFAULT 'Anonimo',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lu_lead ON lead_updates(lead_id);

-- 3. RLS
ALTER TABLE lead_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_updates    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text; op text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lead_candidates', 'lead_updates'] LOOP
    FOREACH op IN ARRAY ARRAY['select','insert','update','delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || ': ' || op || ' allowed', t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "lead_candidates: select allowed" ON lead_candidates
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "lead_candidates: insert allowed" ON lead_candidates
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "lead_candidates: update allowed" ON lead_candidates
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "lead_candidates: delete allowed" ON lead_candidates
  FOR DELETE USING (is_allowed_user());

CREATE POLICY "lead_updates: select allowed" ON lead_updates
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "lead_updates: insert allowed" ON lead_updates
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "lead_updates: update allowed" ON lead_updates
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "lead_updates: delete allowed" ON lead_updates
  FOR DELETE USING (is_allowed_user());
