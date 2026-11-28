-- migrate:up
-- Directus ignores a table with a composite primary key, and editors review these rows there.
-- (video_id, place_id) stays unique: it is the matcher's conflict target.
ALTER TABLE video_place_matches ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE video_place_matches DROP CONSTRAINT video_place_matches_pkey;
ALTER TABLE video_place_matches ADD CONSTRAINT video_place_matches_pkey PRIMARY KEY (id);
ALTER TABLE video_place_matches ADD CONSTRAINT vpm_video_place_uq UNIQUE (video_id, place_id);

-- migrate:down
ALTER TABLE video_place_matches DROP CONSTRAINT vpm_video_place_uq;
ALTER TABLE video_place_matches DROP CONSTRAINT video_place_matches_pkey;
ALTER TABLE video_place_matches ADD CONSTRAINT video_place_matches_pkey PRIMARY KEY (video_id, place_id);
ALTER TABLE video_place_matches DROP COLUMN id;
