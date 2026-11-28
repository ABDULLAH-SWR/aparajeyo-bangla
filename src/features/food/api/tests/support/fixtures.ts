/// <reference types="bun" />
// Row builders that satisfy the head schema. Tests override only the column under test.
import { readFileSync } from "node:fs";
import type postgres from "postgres";

export const DHAKA = "BD3026";
export const BOGURA = "BD5010";
export const BOGURA_SADAR = "BD50100020";
export const DHANMONDI = "BD30260014";

const GEO_SEED = new URL("../../../db/seeds/test_geo.sql", import.meta.url);

/** Two districts with one upazila each. The Vitest template database already holds them. */
export async function seedGeo(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(readFileSync(GEO_SEED, "utf8"));
}

/** One more district, for tests that need more than the geo fixture holds. */
export async function insertDistrict(sql: postgres.Sql, id: string, name: string): Promise<void> {
  await sql`INSERT INTO geo_districts (id, name_en, name_bn, geom)
    VALUES (${id}, ${name}, ${name},
      ST_GeomFromText('MULTIPOLYGON(((91.7 22.2,91.9 22.2,91.9 22.4,91.7 22.4,91.7 22.2)))', 4326))`;
}

export async function insertPlace(
  sql: postgres.Sql,
  overrides: Record<string, string | boolean | string[] | null> = {},
): Promise<string> {
  const row = {
    overlay_type: "food",
    source: "osm",
    source_id: `node/${crypto.randomUUID()}`,
    district_id: DHAKA,
    upazila_id: null,
    geom: "SRID=4326;POINT(90.4 23.8)",
    name_en: "Test Kitchen",
    name_norm: "test kitchen",
    category: "restaurant",
    cuisines: ["bangladeshi"],
    source_license: "ODbL-1.0",
    ...overrides,
  };
  const [inserted] = await sql`INSERT INTO places ${sql(row)} RETURNING id`;
  return inserted!.id as string;
}

export async function insertPhoto(
  sql: postgres.Sql,
  placeId: string,
  overrides: Record<string, string | number> = {},
): Promise<void> {
  const sha256 = String(overrides.sha256 ?? "a".repeat(64));
  const row = {
    place_id: placeId,
    s3_key: `photos/food/${placeId}/${sha256}.jpg`,
    sha256,
    source: "wikimedia",
    author: "Example Author",
    license: "CC BY-SA 4.0",
    license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
    source_page_url: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    width: 800,
    height: 600,
    ...overrides,
  };
  await sql`INSERT INTO place_photos ${sql(row)}`;
}

const CHANNEL_ID = `UC${"a".repeat(22)}`;

/** Inserts a video with a contract-valid channel ID, creating the channel on first use. */
export async function insertVideo(sql: postgres.Sql, videoId: string): Promise<void> {
  await sql`INSERT INTO youtube_channels (channel_id, uploads_playlist_id, title, overlay_type)
    VALUES (${CHANNEL_ID}, 'UUtest', 'Dhaka Eats', 'food') ON CONFLICT (channel_id) DO NOTHING`;
  await sql`INSERT INTO youtube_videos
    (video_id, channel_id, title, published_at, duration_seconds, last_verified_at)
    VALUES (${videoId}, ${CHANNEL_ID}, 'Old Dhaka food walk', '2026-10-05T20:30:00Z', 900, now())`;
}

export async function insertMatch(
  sql: postgres.Sql,
  videoId: string,
  placeId: string,
  overrides: Record<string, string | number | Date> = {},
): Promise<void> {
  const row = {
    video_id: videoId,
    place_id: placeId,
    confidence: 0.9,
    method: "title_fuzzy",
    status: "approved",
    ...overrides,
  };
  await sql`INSERT INTO video_place_matches ${sql(row)}`;
}

/** A succeeded POI import. dataset_version is deliberately unrelated: the API derives it from finished_at. */
export async function insertImportRun(sql: postgres.Sql, finishedAt = "2026-11-20T04:00:00Z"): Promise<void> {
  await sql`INSERT INTO sync_runs (source, dataset_version, imported_count, status, finished_at)
    VALUES ('food_poi_import', 'unused', 0, 'succeeded', ${finishedAt})`;
}
