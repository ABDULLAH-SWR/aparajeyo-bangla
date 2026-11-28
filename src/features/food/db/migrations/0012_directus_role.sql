-- migrate:up
-- Appendix A.10 (numbered 0011 there; 0011 is taken by sync_runs_status).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'directus_food') THEN CREATE ROLE directus_food NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS directus AUTHORIZATION directus_food;   -- Directus system tables live here
GRANT USAGE ON SCHEMA public TO directus_food;

GRANT SELECT ON places, place_photos, youtube_channels, youtube_videos, video_place_matches,
                conflation_review_queue, geo_districts, geo_upazilas
  TO directus_food;
GRANT UPDATE (name_en_override, name_bn_override, geom_override, is_hidden, is_featured) ON places TO directus_food;
GRANT UPDATE (status, reviewed_by, reviewed_at) ON video_place_matches TO directus_food;
GRANT UPDATE (status) ON conflation_review_queue TO directus_food;
GRANT INSERT (channel_id, title, overlay_type, is_active), UPDATE (title, is_active) ON youtube_channels TO directus_food;

-- Editors supply channel_id only; the uploads playlist is derived (UC… → UU…). The default exists so
-- that Directus does not demand the column from them; the trigger always replaces it.
ALTER TABLE youtube_channels ALTER COLUMN uploads_playlist_id SET DEFAULT '';
CREATE OR REPLACE FUNCTION food_trg_channel_uploads() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.uploads_playlist_id := 'UU' || substr(NEW.channel_id, 3);
  RETURN NEW;
END $$;
CREATE TRIGGER youtube_channels_uploads BEFORE INSERT OR UPDATE OF channel_id ON youtube_channels
  FOR EACH ROW EXECUTE FUNCTION food_trg_channel_uploads();
-- Rows written before the trigger existed must satisfy the constraint.
UPDATE youtube_channels SET uploads_playlist_id = 'UU' || substr(channel_id, 3)
WHERE uploads_playlist_id <> 'UU' || substr(channel_id, 3);
ALTER TABLE youtube_channels ADD CONSTRAINT youtube_channels_uploads_chk
  CHECK (uploads_playlist_id = 'UU' || substr(channel_id, 3));

-- migrate:down
ALTER TABLE youtube_channels DROP CONSTRAINT youtube_channels_uploads_chk;
DROP TRIGGER youtube_channels_uploads ON youtube_channels;
DROP FUNCTION food_trg_channel_uploads();
ALTER TABLE youtube_channels ALTER COLUMN uploads_playlist_id DROP DEFAULT;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM directus_food;
REVOKE USAGE ON SCHEMA public FROM directus_food;
-- The directus schema and role are kept: dropping them destroys Directus state.
