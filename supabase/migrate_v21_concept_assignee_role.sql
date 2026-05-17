-- v21: add role column to concept_assignees
ALTER TABLE concept_assignees
  ADD COLUMN IF NOT EXISTS role text DEFAULT NULL;
