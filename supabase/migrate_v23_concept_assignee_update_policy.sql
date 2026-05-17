-- v23: add missing UPDATE policy on concept_assignees
-- The original v7 migration created SELECT, INSERT, DELETE policies
-- but forgot UPDATE. Without it Supabase silently drops setRole calls
-- (RLS blocks the UPDATE, returns 0 rows and no error).
DROP POLICY IF EXISTS "ca: update allowed" ON concept_assignees;
CREATE POLICY "ca: update allowed" ON concept_assignees
  FOR UPDATE USING (is_allowed_user()) WITH CHECK (is_allowed_user());
