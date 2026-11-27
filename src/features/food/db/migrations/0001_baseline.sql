-- migrate:up
-- Schema-only dump of the pre-dbmate dev database (pg_dump 17.5 --schema-only --no-owner --no-privileges)
-- for the 9 Food tables. One line is omitted from the dump: set_config('search_path', '', false), which
-- is session-wide and would break every later migration run on the same connection.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Debian 17.5-1.pgdg110+1)
-- Dumped by pg_dump version 17.5 (Debian 17.5-1.pgdg110+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conflation_review_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conflation_review_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    primary_place_id uuid NOT NULL,
    candidate_place_id uuid NOT NULL,
    distance_m numeric(6,2) NOT NULL,
    name_similarity numeric(3,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conflation_review_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'merged'::text, 'rejected'::text])))
);


--
-- Name: geo_districts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_districts (
    id character(6) NOT NULL,
    name_en text NOT NULL,
    name_bn text NOT NULL,
    geom public.geometry(MultiPolygon,4326) NOT NULL
);


--
-- Name: geo_upazilas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_upazilas (
    id character(10) NOT NULL,
    district_id character(6) NOT NULL,
    name_en text NOT NULL,
    name_bn text NOT NULL,
    geom public.geometry(MultiPolygon,4326) NOT NULL
);


--
-- Name: place_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.place_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    s3_key text NOT NULL,
    sha256 character(64) NOT NULL,
    source text NOT NULL,
    commons_title text,
    author text NOT NULL,
    license text NOT NULL,
    license_url text NOT NULL,
    source_page_url text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    CONSTRAINT place_photos_source_check CHECK ((source = ANY (ARRAY['wikimedia'::text, 'ugc'::text])))
);


--
-- Name: places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    overlay_type text NOT NULL,
    source text NOT NULL,
    source_id text NOT NULL,
    merged_source_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    district_id character(6) NOT NULL,
    upazila_id character(10),
    geom public.geometry(Point,4326) NOT NULL,
    name_en text,
    name_bn text,
    name_norm text NOT NULL,
    name_roman text DEFAULT ''::text NOT NULL,
    category text NOT NULL,
    cuisines text[] DEFAULT '{}'::text[] NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    wikimedia_s3_keys jsonb DEFAULT '[]'::jsonb NOT NULL,
    youtube_video_ids text[] DEFAULT '{}'::text[] NOT NULL,
    source_license text NOT NULL,
    source_confidence numeric(3,2),
    name_en_override text,
    name_bn_override text,
    geom_override public.geometry(Point,4326),
    is_hidden boolean DEFAULT false NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    missed_imports smallint DEFAULT 0 NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT places_check CHECK (((name_en IS NOT NULL) OR (name_bn IS NOT NULL))),
    CONSTRAINT places_overlay_type_check CHECK ((overlay_type = ANY (ARRAY['food'::text, 'travel'::text]))),
    CONSTRAINT places_source_check CHECK ((source = ANY (ARRAY['osm'::text, 'overture'::text])))
);


--
-- Name: sync_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_runs (
    id integer NOT NULL,
    source text NOT NULL,
    dataset_version text NOT NULL,
    imported_count integer NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone DEFAULT now() NOT NULL,
    notes jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: sync_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_runs_id_seq OWNED BY public.sync_runs.id;


--
-- Name: video_place_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_place_matches (
    video_id text NOT NULL,
    place_id uuid NOT NULL,
    confidence numeric(3,2) NOT NULL,
    method text NOT NULL,
    start_seconds integer,
    status text NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    CONSTRAINT video_place_matches_method_check CHECK ((method = ANY (ARRAY['chapter'::text, 'title_fuzzy'::text, 'llm'::text, 'manual'::text]))),
    CONSTRAINT video_place_matches_status_check CHECK ((status = ANY (ARRAY['auto_approved'::text, 'pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: youtube_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.youtube_channels (
    channel_id text NOT NULL,
    uploads_playlist_id text NOT NULL,
    title text NOT NULL,
    overlay_type text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_polled_at timestamp with time zone,
    last_seen_video_id text,
    CONSTRAINT youtube_channels_overlay_type_check CHECK ((overlay_type = ANY (ARRAY['food'::text, 'travel'::text])))
);


--
-- Name: youtube_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.youtube_videos (
    video_id text NOT NULL,
    channel_id text NOT NULL,
    title text NOT NULL,
    description text,
    published_at timestamp with time zone NOT NULL,
    duration_seconds integer NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    last_verified_at timestamp with time zone NOT NULL
);


--
-- Name: sync_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_runs ALTER COLUMN id SET DEFAULT nextval('public.sync_runs_id_seq'::regclass);


--
-- Name: conflation_review_queue conflation_review_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflation_review_queue
    ADD CONSTRAINT conflation_review_queue_pkey PRIMARY KEY (id);


--
-- Name: conflation_review_queue conflation_review_queue_primary_place_id_candidate_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflation_review_queue
    ADD CONSTRAINT conflation_review_queue_primary_place_id_candidate_place_id_key UNIQUE (primary_place_id, candidate_place_id);


--
-- Name: geo_districts geo_districts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_pkey PRIMARY KEY (id);


--
-- Name: geo_upazilas geo_upazilas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_upazilas
    ADD CONSTRAINT geo_upazilas_pkey PRIMARY KEY (id);


--
-- Name: place_photos place_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_photos
    ADD CONSTRAINT place_photos_pkey PRIMARY KEY (id);


--
-- Name: place_photos place_photos_sha256_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_photos
    ADD CONSTRAINT place_photos_sha256_key UNIQUE (sha256);


--
-- Name: places places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_pkey PRIMARY KEY (id);


--
-- Name: places places_source_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_source_source_id_key UNIQUE (source, source_id);


--
-- Name: sync_runs sync_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_runs
    ADD CONSTRAINT sync_runs_pkey PRIMARY KEY (id);


--
-- Name: video_place_matches video_place_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_place_matches
    ADD CONSTRAINT video_place_matches_pkey PRIMARY KEY (video_id, place_id);


--
-- Name: youtube_channels youtube_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youtube_channels
    ADD CONSTRAINT youtube_channels_pkey PRIMARY KEY (channel_id);


--
-- Name: youtube_videos youtube_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youtube_videos
    ADD CONSTRAINT youtube_videos_pkey PRIMARY KEY (video_id);


--
-- Name: geo_districts_geom_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geo_districts_geom_gix ON public.geo_districts USING gist (geom);


--
-- Name: geo_upazilas_dist_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geo_upazilas_dist_idx ON public.geo_upazilas USING btree (district_id);


--
-- Name: geo_upazilas_geom_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX geo_upazilas_geom_gix ON public.geo_upazilas USING gist (geom);


--
-- Name: place_photos_place_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX place_photos_place_idx ON public.place_photos USING btree (place_id, sort_order);


--
-- Name: places_food_dist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX places_food_dist ON public.places USING btree (overlay_type, district_id, category) WHERE (is_active AND (NOT is_hidden));


--
-- Name: places_geog_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX places_geog_gix ON public.places USING gist (((geom)::public.geography));


--
-- Name: places_geom_gix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX places_geom_gix ON public.places USING gist (geom);


--
-- Name: places_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX places_name_trgm ON public.places USING gin (name_norm public.gin_trgm_ops);


--
-- Name: places_roman_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX places_roman_trgm ON public.places USING gin (name_roman public.gin_trgm_ops);


--
-- Name: conflation_review_queue conflation_review_queue_candidate_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflation_review_queue
    ADD CONSTRAINT conflation_review_queue_candidate_place_id_fkey FOREIGN KEY (candidate_place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: conflation_review_queue conflation_review_queue_primary_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conflation_review_queue
    ADD CONSTRAINT conflation_review_queue_primary_place_id_fkey FOREIGN KEY (primary_place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: geo_upazilas geo_upazilas_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_upazilas
    ADD CONSTRAINT geo_upazilas_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id);


--
-- Name: place_photos place_photos_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_photos
    ADD CONSTRAINT place_photos_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: video_place_matches video_place_matches_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_place_matches
    ADD CONSTRAINT video_place_matches_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id) ON DELETE CASCADE;


--
-- Name: video_place_matches video_place_matches_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_place_matches
    ADD CONSTRAINT video_place_matches_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.youtube_videos(video_id);


--
-- Name: youtube_videos youtube_videos_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youtube_videos
    ADD CONSTRAINT youtube_videos_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.youtube_channels(channel_id);


--
-- PostgreSQL database dump complete
--

-- migrate:down
DROP TABLE conflation_review_queue, video_place_matches, youtube_videos, youtube_channels,
           place_photos, places, geo_upazilas, geo_districts, sync_runs;
