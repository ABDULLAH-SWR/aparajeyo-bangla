-- Loaded once into the API test template database (api/tests/support/global-setup.ts).
-- Every test file starts from these rows: two districts with one upazila each, and one succeeded
-- POI import. Keep the geo rows equal to seedGeo() in api/tests/support/fixtures.ts.
INSERT INTO geo_districts (id, name_en, name_bn, geom) VALUES
  ('BD3026', 'Dhaka', 'Dhaka',
   ST_GeomFromText('MULTIPOLYGON(((90.3 23.7,90.5 23.7,90.5 23.9,90.3 23.9,90.3 23.7)))', 4326)),
  ('BD5010', 'Bogura', 'Bogura',
   ST_GeomFromText('MULTIPOLYGON(((89.3 24.8,89.5 24.8,89.5 25.0,89.3 25.0,89.3 24.8)))', 4326));

INSERT INTO geo_upazilas (id, district_id, name_en, name_bn, geom) VALUES
  ('BD30260014', 'BD3026', 'Dhanmondi', 'Dhanmondi',
   ST_GeomFromText('MULTIPOLYGON(((90.3 23.7,90.5 23.7,90.5 23.9,90.3 23.9,90.3 23.7)))', 4326)),
  ('BD50100020', 'BD5010', 'Bogura Sadar', 'Bogura Sadar',
   ST_GeomFromText('MULTIPOLYGON(((89.3 24.8,89.5 24.8,89.5 25.0,89.3 25.0,89.3 24.8)))', 4326));

-- Older than any run a test inserts, so a test's own run is always the latest.
INSERT INTO sync_runs (source, dataset_version, imported_count, status, finished_at)
VALUES ('food_poi_import', 'unused', 0, 'succeeded', '2026-01-01T00:00:00Z');
