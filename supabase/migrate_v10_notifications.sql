-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL,
  title         text NOT NULL,
  body          text,
  entity_id     uuid,
  entity_type   text CHECK (entity_type IN ('lead', 'concept', 'offer')),
  read          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notifications"
  ON notifications FOR ALL
  USING (is_allowed_user() AND user_id = auth.uid())
  WITH CHECK (is_allowed_user() AND user_id = auth.uid());

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_lead_promoted     boolean NOT NULL DEFAULT true,
  in_app_lead_archived     boolean NOT NULL DEFAULT true,
  in_app_offer_deadline    boolean NOT NULL DEFAULT true,
  in_app_concept_status    boolean NOT NULL DEFAULT true,
  email_lead_promoted      boolean NOT NULL DEFAULT false,
  email_lead_archived      boolean NOT NULL DEFAULT false,
  email_offer_deadline     boolean NOT NULL DEFAULT false,
  email_concept_status     boolean NOT NULL DEFAULT false,
  deadline_days_before     integer NOT NULL DEFAULT 7
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
  ON notification_preferences FOR ALL
  USING (is_allowed_user() AND user_id = auth.uid())
  WITH CHECK (is_allowed_user() AND user_id = auth.uid());
