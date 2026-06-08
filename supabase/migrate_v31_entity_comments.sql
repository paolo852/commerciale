-- v31: commenti generici su concept / offerte / lead
CREATE TABLE IF NOT EXISTS entity_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text        NOT NULL CHECK (entity_type IN ('concept', 'offer', 'lead')),
  entity_id   uuid        NOT NULL,
  author_name text        NOT NULL,
  body        text        NOT NULL
);

CREATE INDEX IF NOT EXISTS entity_comments_entity_idx ON entity_comments (entity_type, entity_id);

ALTER TABLE entity_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allowed users read entity comments"   ON entity_comments;
DROP POLICY IF EXISTS "Allowed users insert entity comments" ON entity_comments;
DROP POLICY IF EXISTS "Allowed users delete entity comments" ON entity_comments;

CREATE POLICY "Allowed users read entity comments"
  ON entity_comments FOR SELECT
  USING (is_allowed_user());

CREATE POLICY "Allowed users insert entity comments"
  ON entity_comments FOR INSERT
  WITH CHECK (is_allowed_user());

CREATE POLICY "Allowed users delete entity comments"
  ON entity_comments FOR DELETE
  USING (is_allowed_user());
