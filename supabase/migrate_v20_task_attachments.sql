-- v20: add file attachment columns to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS attachment_url  text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attachment_name text DEFAULT NULL;

-- Storage bucket for task file attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-files', 'task-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "allowed users manage task-files"
ON storage.objects FOR ALL
USING (bucket_id = 'task-files' AND is_allowed_user())
WITH CHECK (bucket_id = 'task-files' AND is_allowed_user());
