-- Loaded once into the API test template database (api/tests/support/global-setup.ts), after
-- test_geo.sql. With it, every Vitest file starts from the geo fixture and one succeeded POI import.

-- Older than any run a test inserts, so a test's own run is always the latest.
INSERT INTO sync_runs (source, dataset_version, imported_count, status, finished_at)
VALUES ('food_poi_import', 'unused', 0, 'succeeded', '2026-01-01T00:00:00Z');
