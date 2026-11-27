-- migrate:up
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM place_photos
    WHERE license !~ '^(CC0( 1\.0)?|Public domain|PD(-[A-Za-z0-9.-]+)?|CC BY(-SA)? (1\.0|2\.0|2\.5|3\.0|4\.0)( [a-z]{2,4})?)$'
  ) THEN
    RAISE EXCEPTION 'place_photos contains non-allowlisted licenses; run food-photo-purge-nonfree first';
  END IF;
END $$;

ALTER TABLE place_photos DROP CONSTRAINT IF EXISTS place_photos_sha256_key;
ALTER TABLE place_photos ADD CONSTRAINT place_photos_place_sha_uq UNIQUE (place_id, sha256);
ALTER TABLE place_photos ADD CONSTRAINT place_photos_license_chk CHECK (
  license ~ '^(CC0( 1\.0)?|Public domain|PD(-[A-Za-z0-9.-]+)?|CC BY(-SA)? (1\.0|2\.0|2\.5|3\.0|4\.0)( [a-z]{2,4})?)$'
);

-- migrate:down
-- Fails by design if any sha256 is shared between places.
ALTER TABLE place_photos DROP CONSTRAINT place_photos_license_chk;
ALTER TABLE place_photos DROP CONSTRAINT place_photos_place_sha_uq;
ALTER TABLE place_photos ADD CONSTRAINT place_photos_sha256_key UNIQUE (sha256);
