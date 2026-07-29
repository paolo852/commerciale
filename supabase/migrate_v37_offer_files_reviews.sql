-- v37: file allegati alle offerte + richieste di revisione ai PM
-- ================================================================

-- Tabella file allegati all'offerta
CREATE TABLE IF NOT EXISTS offer_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id    uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename    text NOT NULL,
  file_path   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_files_offer_id_idx ON offer_files(offer_id);

ALTER TABLE offer_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage offer files"
  ON offer_files FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());

-- Storage bucket privato per i file offerta (signed URL on-demand)
INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-files', 'offer-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "offer files upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'offer-files' AND auth.role() = 'authenticated');

CREATE POLICY "offer files read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'offer-files' AND auth.role() = 'authenticated');

CREATE POLICY "offer files delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'offer-files' AND auth.uid() = owner);

-- Richieste di revisione: una riga per ogni PM invitato a rivedere
CREATE TABLE IF NOT EXISTS offer_reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id          uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  reviewer_pm_id    uuid NOT NULL REFERENCES project_managers(id) ON DELETE CASCADE,
  requester_email   text NOT NULL,
  requester_name    text,
  note              text,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  completed_note    text,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_reviews_offer_id_idx ON offer_reviews(offer_id);
CREATE INDEX IF NOT EXISTS offer_reviews_reviewer_idx ON offer_reviews(reviewer_pm_id);

ALTER TABLE offer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage offer reviews"
  ON offer_reviews FOR ALL
  USING (is_allowed_user())
  WITH CHECK (is_allowed_user());
