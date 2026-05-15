-- v18: field-level comments on the Product Concept Template

CREATE TABLE IF NOT EXISTS concept_field_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id),
  concept_id uuid NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  field_key  text NOT NULL,
  parent_id  uuid REFERENCES concept_field_comments(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE concept_field_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed users manage concept_field_comments"
  ON concept_field_comments
  FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());

CREATE INDEX IF NOT EXISTS idx_cfc_concept_id ON concept_field_comments(concept_id);
