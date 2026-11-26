-- Aparajeyo Food Overlay: PostgreSQL 17 + PostGIS + pg_trgm Schema (Guide §5.1, §7)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. HDX COD-AB v03 Boundaries (64 Districts & 507 ADM3 Units)
CREATE TABLE IF NOT EXISTS geo_districts (
  id       char(6) PRIMARY KEY,
  name_en  text NOT NULL,
  name_bn  text NOT NULL,
  geom     geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS geo_districts_geom_gix ON geo_districts USING gist (geom);

CREATE TABLE IF NOT EXISTS geo_upazilas (
  id           char(10) PRIMARY KEY,
  district_id  char(6) NOT NULL REFERENCES geo_districts(id),
  name_en      text NOT NULL,
  name_bn      text NOT NULL,
  geom         geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS geo_upazilas_geom_gix ON geo_upazilas USING gist (geom);
CREATE INDEX IF NOT EXISTS geo_upazilas_dist_idx ON geo_upazilas (district_id);

-- 2. ODbL-Clean Base Places Table (Guide §7)
CREATE TABLE IF NOT EXISTS places (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_type       text NOT NULL CHECK (overlay_type IN ('food', 'travel')),
  source             text NOT NULL CHECK (source IN ('osm', 'overture')),
  source_id          text NOT NULL,
  merged_source_ids  jsonb NOT NULL DEFAULT '[]',
  district_id        char(6) NOT NULL,
  upazila_id         char(10),
  geom               geometry(Point, 4326) NOT NULL,
  name_en            text,
  name_bn            text,
  name_norm          text NOT NULL,
  name_roman         text NOT NULL DEFAULT '',
  category           text NOT NULL,
  cuisines           text[] NOT NULL DEFAULT '{}',
  tags               jsonb NOT NULL DEFAULT '{}',
  wikimedia_s3_keys  jsonb NOT NULL DEFAULT '[]',
  youtube_video_ids  text[] NOT NULL DEFAULT '{}',
  source_license     text NOT NULL,
  source_confidence  numeric(3, 2),
  -- Editorial overrides (never overwritten by importers)
  name_en_override   text,
  name_bn_override   text,
  geom_override      geometry(Point, 4326),
  is_hidden          boolean NOT NULL DEFAULT false,
  is_featured        boolean NOT NULL DEFAULT false,
  -- Lifecycle
  is_active          boolean NOT NULL DEFAULT true,
  missed_imports     smallint NOT NULL DEFAULT 0,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id),
  CHECK (name_en IS NOT NULL OR name_bn IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS places_geom_gix ON places USING gist (geom);
CREATE INDEX IF NOT EXISTS places_geog_gix ON places USING gist ((geom::geography));
CREATE INDEX IF NOT EXISTS places_food_dist ON places (overlay_type, district_id, category) WHERE is_active AND NOT is_hidden;
CREATE INDEX IF NOT EXISTS places_name_trgm ON places USING gin (name_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS places_roman_trgm ON places USING gin (name_roman gin_trgm_ops);

-- 3. Wikimedia Commons / Phase 4 UGC Photos
CREATE TABLE IF NOT EXISTS place_photos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id         uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  s3_key           text NOT NULL,
  sha256           char(64) NOT NULL UNIQUE,
  source           text NOT NULL CHECK (source IN ('wikimedia', 'ugc')),
  commons_title    text,
  author           text NOT NULL,
  license          text NOT NULL,
  license_url      text NOT NULL,
  source_page_url  text NOT NULL,
  width            int NOT NULL,
  height           int NOT NULL,
  sort_order       smallint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS place_photos_place_idx ON place_photos (place_id, sort_order);

-- 4. YouTube Channel Registry, Videos & Matches (Guide §7)
CREATE TABLE IF NOT EXISTS youtube_channels (
  channel_id          text PRIMARY KEY,
  uploads_playlist_id text NOT NULL,
  title               text NOT NULL,
  overlay_type        text NOT NULL CHECK (overlay_type IN ('food', 'travel')),
  is_active           boolean NOT NULL DEFAULT true,
  last_polled_at      timestamptz,
  last_seen_video_id  text
);

CREATE TABLE IF NOT EXISTS youtube_videos (
  video_id          text PRIMARY KEY,
  channel_id        text NOT NULL REFERENCES youtube_channels(channel_id),
  title             text NOT NULL,
  description       text,
  published_at      timestamptz NOT NULL,
  duration_seconds  int NOT NULL,
  is_available      boolean NOT NULL DEFAULT true,
  last_verified_at  timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS video_place_matches (
  video_id       text NOT NULL REFERENCES youtube_videos(video_id),
  place_id       uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  confidence     numeric(3, 2) NOT NULL,
  method         text NOT NULL CHECK (method IN ('chapter', 'title_fuzzy', 'llm', 'manual')),
  start_seconds  int,
  status         text NOT NULL CHECK (status IN ('auto_approved', 'pending', 'approved', 'rejected')),
  reviewed_by    text,
  reviewed_at    timestamptz,
  PRIMARY KEY (video_id, place_id)
);

-- 5. Sync & Conflation Audit Logs
CREATE TABLE IF NOT EXISTS sync_runs (
  id              serial PRIMARY KEY,
  source          text NOT NULL,
  dataset_version text NOT NULL,
  imported_count  int NOT NULL,
  status          text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz NOT NULL DEFAULT now(),
  notes           jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS conflation_review_queue (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_place_id   uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  candidate_place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  distance_m         numeric(6, 2) NOT NULL,
  name_similarity    numeric(3, 2) NOT NULL,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'rejected')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (primary_place_id, candidate_place_id)
);
