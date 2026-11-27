-- migrate:up
ALTER TABLE video_place_matches ADD COLUMN matched_at timestamptz NOT NULL DEFAULT now();
UPDATE video_place_matches SET reviewed_at = NULL, reviewed_by = NULL
WHERE status IN ('auto_approved', 'pending');
ALTER TABLE video_place_matches ADD CONSTRAINT vpm_unreviewed_machine_rows_chk CHECK (
  status NOT IN ('auto_approved', 'pending') OR (reviewed_at IS NULL AND reviewed_by IS NULL));
CREATE INDEX vpm_place_visible_ix ON video_place_matches (place_id)
  WHERE status IN ('auto_approved', 'approved');
CREATE INDEX vpm_pending_ix ON video_place_matches (confidence DESC) WHERE status = 'pending';

ALTER TABLE youtube_videos
  ADD COLUMN content_hash       text,
  ADD COLUMN content_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN matched_at         timestamptz;
CREATE INDEX yv_verify_ix ON youtube_videos (last_verified_at) WHERE is_available;
CREATE INDEX yv_match_pending_ix ON youtube_videos (content_changed_at)
  WHERE matched_at IS NULL OR matched_at < content_changed_at;

-- migrate:down
DROP INDEX yv_match_pending_ix;
DROP INDEX yv_verify_ix;
ALTER TABLE youtube_videos DROP COLUMN matched_at, DROP COLUMN content_changed_at, DROP COLUMN content_hash;
DROP INDEX vpm_pending_ix;
DROP INDEX vpm_place_visible_ix;
ALTER TABLE video_place_matches DROP CONSTRAINT vpm_unreviewed_machine_rows_chk;
ALTER TABLE video_place_matches DROP COLUMN matched_at;
