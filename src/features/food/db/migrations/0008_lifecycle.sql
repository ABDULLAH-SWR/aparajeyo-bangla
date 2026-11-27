-- migrate:up
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS name_roman text,
  ADD COLUMN merged_into      uuid REFERENCES places (id),
  ADD COLUMN photos_synced_at timestamptz;
ALTER TABLE places ADD CONSTRAINT places_merged_inactive_chk CHECK (merged_into IS NULL OR NOT is_active);
CREATE INDEX places_merged_into_ix ON places (merged_into) WHERE merged_into IS NOT NULL;
CREATE INDEX places_photo_sync_ix ON places (photos_synced_at NULLS FIRST, id)
  WHERE overlay_type = 'food' AND is_active;

CREATE TABLE food_import_rejects (
  id         bigserial PRIMARY KEY,
  run_id     bigint NOT NULL,                       -- sync_runs.id of the import run
  source     text NOT NULL CHECK (source IN ('osm', 'overture')),
  source_id  text NOT NULL,
  reason     text NOT NULL CHECK (reason IN ('outside_admin_polygons', 'no_name', 'unmapped_category', 'low_confidence')),
  geom       geometry(Point, 4326),
  logged_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX food_import_rejects_run_ix ON food_import_rejects (run_id);

-- migrate:down
DROP TABLE food_import_rejects;
DROP INDEX places_photo_sync_ix;
DROP INDEX places_merged_into_ix;
ALTER TABLE places DROP CONSTRAINT places_merged_inactive_chk;
ALTER TABLE places DROP COLUMN photos_synced_at, DROP COLUMN merged_into;
