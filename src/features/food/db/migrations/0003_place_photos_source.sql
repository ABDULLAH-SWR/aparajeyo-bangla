-- migrate:up
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM place_photos WHERE source <> 'wikimedia') THEN
    RAISE EXCEPTION 'place_photos contains non-wikimedia rows; UGC belongs in the ugc schema (R13)';
  END IF;
END $$;
ALTER TABLE place_photos DROP CONSTRAINT IF EXISTS place_photos_source_check;
ALTER TABLE place_photos ADD CONSTRAINT place_photos_source_chk CHECK (source = 'wikimedia');

-- migrate:down
ALTER TABLE place_photos DROP CONSTRAINT place_photos_source_chk;
ALTER TABLE place_photos ADD CONSTRAINT place_photos_source_check CHECK (source IN ('wikimedia', 'ugc'));
