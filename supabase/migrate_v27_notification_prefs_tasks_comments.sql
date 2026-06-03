-- v27: add task_assigned and comment_mention to notification_preferences

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS in_app_task_assigned   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS in_app_comment_mention boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_task_assigned    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_comment_mention  boolean NOT NULL DEFAULT false;
