CREATE TABLE IF NOT EXISTS tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  body          text,
  pm_id         uuid REFERENCES project_managers(id) ON DELETE SET NULL,
  entity_id     uuid,
  entity_type   text CHECK (entity_type IN ('lead', 'concept', 'offer')),
  due_date      date,
  completed     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_pm_id_idx    ON tasks(pm_id);
CREATE INDEX IF NOT EXISTS tasks_completed_idx ON tasks(completed);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage tasks"
  ON tasks FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());
