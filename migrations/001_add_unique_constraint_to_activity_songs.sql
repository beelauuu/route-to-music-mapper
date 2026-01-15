-- Migration: Add unique constraint to prevent duplicate songs
-- This ensures that the same song (identified by spotify_track_id and played_at)
-- cannot be inserted multiple times for the same activity

-- First, remove any existing duplicates before adding the constraint
DELETE FROM activity_songs a USING (
  SELECT MIN(id) as id, activity_id, spotify_track_id, played_at
  FROM activity_songs
  GROUP BY activity_id, spotify_track_id, played_at
  HAVING COUNT(*) > 1
) b
WHERE a.activity_id = b.activity_id
  AND a.spotify_track_id = b.spotify_track_id
  AND a.played_at = b.played_at
  AND a.id <> b.id;

-- Add unique constraint to prevent future duplicates
-- We use activity_id + spotify_track_id + played_at as the unique key
-- This allows the same song to be played multiple times in the same activity
-- (at different times), but prevents exact duplicates
ALTER TABLE activity_songs
ADD CONSTRAINT unique_activity_song_play
UNIQUE (activity_id, spotify_track_id, played_at);

-- Create an index to improve performance of the upsert operations
CREATE INDEX IF NOT EXISTS idx_activity_songs_unique_play
ON activity_songs(activity_id, spotify_track_id, played_at);
