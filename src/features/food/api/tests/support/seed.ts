// Seed rows that fixtures.ts does not provide.
import type postgres from "postgres";

export async function insertDistrict(sql: postgres.Sql, id: string, name: string): Promise<void> {
  await sql`INSERT INTO geo_districts (id, name_en, name_bn, geom)
    VALUES (${id}, ${name}, ${name},
      ST_GeomFromText('MULTIPOLYGON(((91.7 22.2,91.9 22.2,91.9 22.4,91.7 22.4,91.7 22.2)))', 4326))`;
}

const CHANNEL_ID = `UC${"a".repeat(22)}`;

/** A video with contract-valid IDs (fixtures.insertVideo uses a short channel ID). */
export async function insertContractVideo(sql: postgres.Sql, videoId: string): Promise<void> {
  await sql`INSERT INTO youtube_channels (channel_id, uploads_playlist_id, title, overlay_type)
    VALUES (${CHANNEL_ID}, 'UUtest', 'Dhaka Eats', 'food') ON CONFLICT (channel_id) DO NOTHING`;
  await sql`INSERT INTO youtube_videos
    (video_id, channel_id, title, published_at, duration_seconds, last_verified_at)
    VALUES (${videoId}, ${CHANNEL_ID}, 'Old Dhaka food walk', '2026-10-05T20:30:00Z', 900, now())`;
}

/** A succeeded POI import. dataset_version is deliberately unrelated: the API derives it from finished_at. */
export async function insertImportRun(sql: postgres.Sql, finishedAt = "2026-11-20T04:00:00Z"): Promise<void> {
  await sql`INSERT INTO sync_runs (source, dataset_version, imported_count, status, finished_at)
    VALUES ('food_poi_import', 'unused', 0, 'succeeded', ${finishedAt})`;
}
