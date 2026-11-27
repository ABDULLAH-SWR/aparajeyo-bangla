/// <reference types="bun" />
// Row builders that satisfy the head schema. Tests override only the column under test.
import type postgres from "postgres";

export const DHAKA = "BD3026";
export const BOGURA = "BD5010";
export const BOGURA_SADAR = "BD50100020";
export const DHANMONDI = "BD30260014";

const square = (lng: number, lat: number) =>
  `MULTIPOLYGON(((${lng} ${lat},${lng + 0.2} ${lat},${lng + 0.2} ${lat + 0.2},${lng} ${lat + 0.2},${lng} ${lat})))`;

/** Two districts with one upazila each. */
export async function seedGeo(sql: postgres.Sql): Promise<void> {
  const districts = [
    { id: DHAKA, name: "Dhaka", geom: square(90.3, 23.7) },
    { id: BOGURA, name: "Bogura", geom: square(89.3, 24.8) },
  ];
  for (const d of districts) {
    await sql`INSERT INTO geo_districts (id, name_en, name_bn, geom)
      VALUES (${d.id}, ${d.name}, ${d.name}, ST_GeomFromText(${d.geom}, 4326))
      ON CONFLICT (id) DO NOTHING`;
  }
  const upazilas = [
    { id: DHANMONDI, district: DHAKA, name: "Dhanmondi", geom: square(90.3, 23.7) },
    { id: BOGURA_SADAR, district: BOGURA, name: "Bogura Sadar", geom: square(89.3, 24.8) },
  ];
  for (const u of upazilas) {
    await sql`INSERT INTO geo_upazilas (id, district_id, name_en, name_bn, geom)
      VALUES (${u.id}, ${u.district}, ${u.name}, ${u.name}, ST_GeomFromText(${u.geom}, 4326))
      ON CONFLICT (id) DO NOTHING`;
  }
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

/** Inserts a video, creating its channel on first use. */
export async function insertVideo(sql: postgres.Sql, videoId: string): Promise<void> {
  await sql`INSERT INTO youtube_channels (channel_id, uploads_playlist_id, title, overlay_type)
    VALUES ('UCtest', 'UUtest', 'Test Channel', 'food') ON CONFLICT (channel_id) DO NOTHING`;
  await sql`INSERT INTO youtube_videos
    (video_id, channel_id, title, published_at, duration_seconds, last_verified_at)
    VALUES (${videoId}, 'UCtest', 'Test Video', now(), 600, now())`;
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
