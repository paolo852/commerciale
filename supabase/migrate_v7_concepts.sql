-- ============================================================
-- Migrazione v7: rinomina Lead → Concept Development
-- ATTENZIONE: distrugge i dati esistenti nelle tabelle leads.
-- Idempotente: può essere rieseguito senza errori.
-- ============================================================

-- 1. Drop tabelle precedenti (e bucket storage)
DROP TABLE IF EXISTS lead_matches CASCADE;
DROP TABLE IF EXISTS lead_files   CASCADE;
DROP TABLE IF EXISTS leads        CASCADE;

DROP POLICY IF EXISTS "lead-files: select allowed" ON storage.objects;
DROP POLICY IF EXISTS "lead-files: insert allowed" ON storage.objects;
DROP POLICY IF EXISTS "lead-files: delete allowed" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'lead-files';
DELETE FROM storage.buckets WHERE id = 'lead-files';

-- 2. Tabella concepts
CREATE TABLE IF NOT EXISTS concepts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               text NOT NULL,
  pi                 text,
  ente               text,
  description        text,
  status             text NOT NULL DEFAULT 'in_valutazione'
                     CHECK (status IN ('in_valutazione', 'promosso', 'rifiutato')),
  notes              text,
  promoted_offer_id  uuid REFERENCES offers(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concepts_user_id ON concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_concepts_status  ON concepts(status);

-- 3. Tabella concept_assignees (many-to-many con project_managers)
CREATE TABLE IF NOT EXISTS concept_assignees (
  concept_id          uuid NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  project_manager_id  uuid NOT NULL REFERENCES project_managers(id) ON DELETE CASCADE,
  added_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (concept_id, project_manager_id)
);
CREATE INDEX IF NOT EXISTS idx_concept_assignees_pm ON concept_assignees(project_manager_id);

-- 4. Tabella concept_versions (file caricati, una riga per versione)
CREATE TABLE IF NOT EXISTS concept_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id      uuid NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  version_number  int  NOT NULL,
  filename        text NOT NULL,
  storage_path    text NOT NULL,
  size            bigint NOT NULL DEFAULT 0,
  mime_type       text,
  uploaded_by     uuid REFERENCES project_managers(id) ON DELETE SET NULL,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  note            text,
  UNIQUE (concept_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_concept_versions_concept ON concept_versions(concept_id);

-- 5. Tabella concept_version_comments
CREATE TABLE IF NOT EXISTS concept_version_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   uuid NOT NULL REFERENCES concept_versions(id) ON DELETE CASCADE,
  author_id    uuid REFERENCES project_managers(id) ON DELETE SET NULL,
  author_name  text NOT NULL,
  body         text NOT NULL,
  mentions     uuid[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ccvc_version ON concept_version_comments(version_id);
CREATE INDEX IF NOT EXISTS idx_ccvc_mentions ON concept_version_comments USING GIN(mentions);

-- 6. Tabella concept_revision_deadlines
CREATE TABLE IF NOT EXISTS concept_revision_deadlines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id  uuid NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  label       text NOT NULL,
  due_date    date NOT NULL,
  completed   boolean NOT NULL DEFAULT false,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crd_concept ON concept_revision_deadlines(concept_id);

-- 7. Tabella concept_matches (AI matching → identica a lead_matches)
CREATE TABLE IF NOT EXISTS concept_matches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id       uuid NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  funding_call_id  uuid NOT NULL REFERENCES funding_calls(id) ON DELETE CASCADE,
  score            int  NOT NULL CHECK (score >= 0 AND score <= 100),
  rationale        text,
  analyzed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (concept_id, funding_call_id)
);
CREATE INDEX IF NOT EXISTS idx_concept_matches_concept ON concept_matches(concept_id);

-- 8. RLS su tutte le tabelle
ALTER TABLE concepts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_assignees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_versions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_version_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_revision_deadlines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_matches             ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  ops text[] := ARRAY['select', 'insert', 'update', 'delete'];
  op text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'concepts', 'concept_assignees', 'concept_versions',
    'concept_version_comments', 'concept_revision_deadlines', 'concept_matches'
  ] LOOP
    FOREACH op IN ARRAY ops LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || ': ' || op || ' allowed', t);
    END LOOP;
  END LOOP;
END $$;

-- Policies generiche su tutte le tabelle concept
CREATE POLICY "concepts: select allowed" ON concepts
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "concepts: insert allowed" ON concepts
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "concepts: update allowed" ON concepts
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "concepts: delete allowed" ON concepts
  FOR DELETE USING (is_allowed_user());

CREATE POLICY "ca: select allowed" ON concept_assignees
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "ca: insert allowed" ON concept_assignees
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "ca: delete allowed" ON concept_assignees
  FOR DELETE USING (is_allowed_user());

CREATE POLICY "cv: select allowed" ON concept_versions
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "cv: insert allowed" ON concept_versions
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "cv: update allowed" ON concept_versions
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "cv: delete allowed" ON concept_versions
  FOR DELETE USING (is_allowed_user());

CREATE POLICY "cvc: select allowed" ON concept_version_comments
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "cvc: insert allowed" ON concept_version_comments
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "cvc: update allowed" ON concept_version_comments
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "cvc: delete allowed" ON concept_version_comments
  FOR DELETE USING (is_allowed_user());

CREATE POLICY "crd: select allowed" ON concept_revision_deadlines
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "crd: insert allowed" ON concept_revision_deadlines
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "crd: update allowed" ON concept_revision_deadlines
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "crd: delete allowed" ON concept_revision_deadlines
  FOR DELETE USING (is_allowed_user());

CREATE POLICY "cm: select allowed" ON concept_matches
  FOR SELECT USING (is_allowed_user());
CREATE POLICY "cm: insert allowed" ON concept_matches
  FOR INSERT WITH CHECK (is_allowed_user());
CREATE POLICY "cm: update allowed" ON concept_matches
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
CREATE POLICY "cm: delete allowed" ON concept_matches
  FOR DELETE USING (is_allowed_user());

-- 9. Storage bucket per le versioni dei concept (privato)
INSERT INTO storage.buckets (id, name, public)
VALUES ('concept-files', 'concept-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "concept-files: select allowed" ON storage.objects;
DROP POLICY IF EXISTS "concept-files: insert allowed" ON storage.objects;
DROP POLICY IF EXISTS "concept-files: delete allowed" ON storage.objects;

CREATE POLICY "concept-files: select allowed" ON storage.objects
  FOR SELECT USING (bucket_id = 'concept-files' AND is_allowed_user());
CREATE POLICY "concept-files: insert allowed" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'concept-files' AND is_allowed_user());
CREATE POLICY "concept-files: delete allowed" ON storage.objects
  FOR DELETE USING (bucket_id = 'concept-files' AND is_allowed_user());
