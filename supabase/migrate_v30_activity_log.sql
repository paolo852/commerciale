-- v30: log delle attività utente
CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_email  text        NOT NULL,
  user_name   text,
  action      text        NOT NULL, -- created | updated | approved | rejected | deleted
  entity_type text        NOT NULL, -- offer
  entity_id   uuid,
  entity_name text        NOT NULL
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allowed users read activity log"   ON activity_log;
DROP POLICY IF EXISTS "Allowed users insert activity log" ON activity_log;

CREATE POLICY "Allowed users read activity log"
  ON activity_log FOR SELECT
  USING (is_allowed_user());

CREATE POLICY "Allowed users insert activity log"
  ON activity_log FOR INSERT
  WITH CHECK (is_allowed_user());
