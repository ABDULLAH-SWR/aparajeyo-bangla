-- migrate:up
-- Adapted from Appendix A.4 to the baseline identifiers: geo_districts.id and geo_upazilas.id.
-- The existing FK is dropped first because a text column cannot be referenced by a char(n) column.
ALTER TABLE geo_upazilas DROP CONSTRAINT geo_upazilas_district_id_fkey;

ALTER TABLE geo_districts ALTER COLUMN id TYPE text USING btrim(id);
ALTER TABLE geo_upazilas
  ALTER COLUMN id          TYPE text USING btrim(id),
  ALTER COLUMN district_id TYPE text USING btrim(district_id);
ALTER TABLE places
  ALTER COLUMN district_id TYPE text USING btrim(district_id),
  ALTER COLUMN upazila_id  TYPE text USING NULLIF(btrim(upazila_id), '');

ALTER TABLE geo_districts ADD CONSTRAINT geo_districts_pcode_chk CHECK (id ~ '^BD[0-9]{4}$');
ALTER TABLE geo_upazilas  ADD CONSTRAINT geo_upazilas_pcode_chk  CHECK (id ~ '^BD[0-9]{8}$');
ALTER TABLE geo_upazilas  ADD CONSTRAINT geo_upazilas_district_fk
  FOREIGN KEY (district_id) REFERENCES geo_districts (id);
ALTER TABLE geo_upazilas  ADD CONSTRAINT geo_upazilas_id_district_uq UNIQUE (id, district_id);

-- Clear cross-district upazilas produced by the old OSM path (audit M1 :319); the next import reassigns them.
DO $$
DECLARE n integer;
BEGIN
  UPDATE places p SET upazila_id = NULL
  WHERE p.upazila_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM geo_upazilas gu
                    WHERE gu.id = p.upazila_id AND gu.district_id = p.district_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'cleared % cross-district upazila assignments', n;
END $$;

ALTER TABLE places ADD CONSTRAINT places_district_fk
  FOREIGN KEY (district_id) REFERENCES geo_districts (id);
ALTER TABLE places ADD CONSTRAINT places_upazila_in_district_fk
  FOREIGN KEY (upazila_id, district_id) REFERENCES geo_upazilas (id, district_id);

-- migrate:down
ALTER TABLE places DROP CONSTRAINT places_upazila_in_district_fk;
ALTER TABLE places DROP CONSTRAINT places_district_fk;
ALTER TABLE geo_upazilas DROP CONSTRAINT geo_upazilas_id_district_uq;
ALTER TABLE geo_upazilas DROP CONSTRAINT geo_upazilas_district_fk;
ALTER TABLE geo_upazilas DROP CONSTRAINT geo_upazilas_pcode_chk;
ALTER TABLE geo_districts DROP CONSTRAINT geo_districts_pcode_chk;
ALTER TABLE geo_upazilas ADD CONSTRAINT geo_upazilas_district_id_fkey
  FOREIGN KEY (district_id) REFERENCES geo_districts (id);
-- Column types stay text (char(n) is not restored; the API no longer trims).
