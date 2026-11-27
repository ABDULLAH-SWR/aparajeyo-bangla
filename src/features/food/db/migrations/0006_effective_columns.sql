-- migrate:up
ALTER TABLE places
  ADD COLUMN eff_geom    geometry(Point, 4326) GENERATED ALWAYS AS (COALESCE(geom_override, geom)) STORED,
  ADD COLUMN eff_name_en text GENERATED ALWAYS AS (COALESCE(name_en_override, name_en)) STORED,
  ADD COLUMN eff_name_bn text GENERATED ALWAYS AS (COALESCE(name_bn_override, name_bn)) STORED;

CREATE INDEX places_food_eff_geom_gix ON places USING gist (eff_geom)
  WHERE overlay_type = 'food' AND is_active AND NOT is_hidden;
CREATE INDEX places_food_district_ix ON places (district_id, category)
  WHERE overlay_type = 'food' AND is_active AND NOT is_hidden;
CREATE INDEX places_food_featured_ix ON places (is_featured DESC, eff_name_en)
  WHERE overlay_type = 'food' AND is_active AND NOT is_hidden
    AND (is_featured OR cardinality(youtube_video_ids) > 0);
DROP INDEX IF EXISTS places_food_dist;

-- migrate:down
CREATE INDEX places_food_dist ON places (overlay_type, district_id, category) WHERE is_active AND NOT is_hidden;
DROP INDEX places_food_featured_ix;
DROP INDEX places_food_district_ix;
DROP INDEX places_food_eff_geom_gix;
ALTER TABLE places DROP COLUMN eff_name_bn, DROP COLUMN eff_name_en, DROP COLUMN eff_geom;
