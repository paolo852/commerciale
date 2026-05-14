CREATE TABLE IF NOT EXISTS concept_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id  uuid NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename    text NOT NULL,
  file_path   text NOT NULL,
  file_url    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS concept_files_concept_id_idx ON concept_files(concept_id);

ALTER TABLE concept_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage concept files"
  ON concept_files FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('concept-files', 'concept-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "concept files upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'concept-files' AND auth.role() = 'authenticated');

CREATE POLICY "concept files read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'concept-files');

CREATE POLICY "concept files delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'concept-files' AND auth.uid() = owner);
