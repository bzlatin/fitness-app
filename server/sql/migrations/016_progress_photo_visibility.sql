ALTER TABLE workout_shares
ADD COLUMN IF NOT EXISTS progress_photo_visibility TEXT;

UPDATE workout_shares
SET progress_photo_visibility = visibility
WHERE progress_photo_url IS NOT NULL
  AND progress_photo_visibility IS NULL;
