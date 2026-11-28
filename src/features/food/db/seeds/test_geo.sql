-- The geo fixture of the API tests: two districts with one upazila each. Safe to run again.
-- Loaded into the Vitest template database (api/tests/support/global-setup.ts) and by seedGeo()
-- (api/tests/support/fixtures.ts) for the databases of tests/repo.
INSERT INTO geo_districts (id, name_en, name_bn, geom) VALUES
  ('BD3026', 'Dhaka', 'Dhaka',
   ST_GeomFromText('MULTIPOLYGON(((90.3 23.7,90.5 23.7,90.5 23.9,90.3 23.9,90.3 23.7)))', 4326)),
  ('BD5010', 'Bogura', 'Bogura',
   ST_GeomFromText('MULTIPOLYGON(((89.3 24.8,89.5 24.8,89.5 25.0,89.3 25.0,89.3 24.8)))', 4326))
ON CONFLICT (id) DO NOTHING;

INSERT INTO geo_upazilas (id, district_id, name_en, name_bn, geom) VALUES
  ('BD30260014', 'BD3026', 'Dhanmondi', 'Dhanmondi',
   ST_GeomFromText('MULTIPOLYGON(((90.3 23.7,90.5 23.7,90.5 23.9,90.3 23.9,90.3 23.7)))', 4326)),
  ('BD50100020', 'BD5010', 'Bogura Sadar', 'Bogura Sadar',
   ST_GeomFromText('MULTIPOLYGON(((89.3 24.8,89.5 24.8,89.5 25.0,89.3 25.0,89.3 24.8)))', 4326))
ON CONFLICT (id) DO NOTHING;
