-- v28: revenue targets per year (shared across all users in the tenant)
CREATE TABLE IF NOT EXISTS revenue_targets (
  year    integer PRIMARY KEY,
  target  numeric NOT NULL DEFAULT 0
);

ALTER TABLE revenue_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allowed users manage revenue targets"
  ON revenue_targets FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());
