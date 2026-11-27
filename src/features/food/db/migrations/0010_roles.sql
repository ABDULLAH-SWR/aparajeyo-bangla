-- migrate:up
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'food_api')    THEN CREATE ROLE food_api NOLOGIN;    END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'food_worker') THEN CREATE ROLE food_worker NOLOGIN; END IF;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO food_api, food_worker;

GRANT SELECT ON places, place_photos, youtube_channels, youtube_videos, video_place_matches,
                geo_districts, geo_upazilas, sync_runs
  TO food_api;

GRANT SELECT, INSERT, UPDATE, DELETE ON places, place_photos, youtube_channels, youtube_videos,
                video_place_matches, conflation_review_queue, sync_runs, food_import_rejects
  TO food_worker;
GRANT SELECT ON geo_districts, geo_upazilas TO food_worker;   -- boundaries are loaded by the owner role
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO food_worker;
GRANT EXECUTE ON FUNCTION food_rebuild_place_media(uuid[]) TO food_worker;

-- osm2pgsql (run by food_worker with --schema=osm_stage) needs a schema it may CREATE in.
CREATE SCHEMA IF NOT EXISTS osm_stage AUTHORIZATION food_worker;

-- migrate:down
-- DROP ROLE fails while another database on the same server still grants these roles privileges.
DROP SCHEMA IF EXISTS osm_stage CASCADE;
REVOKE ALL ON FUNCTION food_rebuild_place_media(uuid[]) FROM food_worker;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM food_api, food_worker;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM food_worker;
REVOKE USAGE ON SCHEMA public FROM food_api, food_worker;
GRANT CREATE ON SCHEMA public TO PUBLIC;
DROP ROLE IF EXISTS food_worker;
DROP ROLE IF EXISTS food_api;
