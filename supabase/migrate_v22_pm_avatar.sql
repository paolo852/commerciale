-- v22: add avatar_url to project_managers + avatars storage bucket
ALTER TABLE project_managers
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;

-- Storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "allowed users manage avatars"
ON storage.objects FOR ALL
USING (bucket_id = 'avatars' AND is_allowed_user())
WITH CHECK (bucket_id = 'avatars' AND is_allowed_user());
