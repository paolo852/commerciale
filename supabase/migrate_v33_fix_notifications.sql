-- v33: fix notifiche
-- 1. Aggiunge colonne v27 in modo idempotente (se non ancora eseguite)
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS in_app_task_assigned   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS in_app_comment_mention boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_task_assigned    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_comment_mention  boolean NOT NULL DEFAULT false;

-- 2. Cambia RLS su notification_preferences:
--    gli utenti possono LEGGERE le prefs di tutti (serve per controllare
--    le preferenze del destinatario prima di inviare email a sue menzioni).
--    Solo il proprietario può modificare le proprie prefs.
DROP POLICY IF EXISTS "Users manage own notification preferences" ON notification_preferences;

CREATE POLICY "Allowed users read notification preferences"
  ON notification_preferences FOR SELECT
  USING (is_allowed_user());

CREATE POLICY "Users insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (is_allowed_user() AND user_id = auth.uid());

CREATE POLICY "Users update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (is_allowed_user());

CREATE POLICY "Users delete own notification preferences"
  ON notification_preferences FOR DELETE
  USING (user_id = auth.uid());
