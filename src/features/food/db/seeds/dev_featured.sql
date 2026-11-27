-- Development seed: at least 3 featured places in Dhaka (BD3026), Chattogram (BD2015),
-- Sylhet (BD6091) and Bogura (BD5010), for local development, Map testing and the k6 featured
-- scenario. Never run it against production: featuring is an editorial decision there.
--
--   psql "$DATABASE_URL_OWNER" -v ON_ERROR_STOP=1 -f db/seeds/dev_featured.sql
--   valkey-cli -n 0 INCR food:epoch      # so a running API drops its cached responses
--
-- It picks from the imported places, preferring those with videos, photos and both names.
-- Already-featured places rank first, so repeated runs change nothing.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY district_id
           ORDER BY is_featured DESC,
                    cardinality(youtube_video_ids) DESC,
                    jsonb_array_length(wikimedia_s3_keys) DESC,
                    (eff_name_en IS NOT NULL AND eff_name_bn IS NOT NULL) DESC,
                    id
         ) AS position
  FROM places
  WHERE overlay_type = 'food' AND is_active AND NOT is_hidden
    AND district_id IN ('BD3026', 'BD2015', 'BD6091', 'BD5010')
)
UPDATE places p
SET is_featured = true
FROM ranked r
WHERE p.id = r.id AND r.position <= 3 AND NOT p.is_featured;
