// SQL only (Guide Appendix A.12). Rows are mapped to DTOs in mappers.ts.
// Baseline identifiers differ from the appendix: geo tables are keyed by `id`, and sync_runs has
// no `job` column (the POI importer is its only writer).
import type { FoodCategory, FoodCuisine, FoodPhotoSource, PlaceSource } from "../types";
import type { PgPool } from "./db";
import type { TileRange } from "./tiles";

export type PinScope =
  | { kind: "district"; id: string }
  | { kind: "bbox"; tiles: TileRange }
  | { kind: "featured" };

export interface PinFilters {
  category?: readonly string[];
  has_video?: boolean;
}

// Enum columns carry the contract types: the CHECK constraints in db/migrations enforce them.
export interface PinRow {
  id: string;
  district_id: string;
  upazila_id: string | null;
  name_en: string | null;
  name_bn: string | null;
  category: FoodCategory;
  source: PlaceSource;
  lng: number;
  lat: number;
  has_video: boolean;
  thumb_s3_key: string | null;
}

const FEATURED_CAP = 2000;
const SCOPED_CAP = 5000;

export const pinCap = (scope: PinScope) => (scope.kind === "featured" ? FEATURED_CAP : SCOPED_CAP);

export interface PlaceRow {
  id: string;
  district_id: string;
  district_name_en: string;
  district_name_bn: string;
  upazila_id: string | null;
  upazila_name_en: string | null;
  upazila_name_bn: string | null;
  lng: number;
  lat: number;
  name_en: string | null;
  name_bn: string | null;
  category: FoodCategory;
  cuisines: FoodCuisine[];
  tags: Record<string, unknown>;
  source: PlaceSource;
  source_id: string;
  source_license: string;
  youtube_video_ids: string[];
  updated_at: string;
}

export interface PhotoRow {
  s3_key: string;
  width: number;
  height: number;
  source: FoodPhotoSource;
  author: string;
  license: string;
  license_url: string;
  source_page_url: string;
}

export interface VideoRow {
  video_id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  published_at: string;
  duration_seconds: number;
  start_seconds: number | null;
}

export function createFoodRepository(sql: PgPool) {
  let datasetMemo: { epoch: number; value: string } | null = null;

  function scopeFragment(scope: PinScope) {
    if (scope.kind === "district") return sql`AND p.district_id = ${scope.id}`;
    if (scope.kind === "bbox") {
      const [west, south, east, north] = scope.tiles.envelope;
      return sql`AND p.eff_geom && ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)`;
    }
    // Must imply the predicate of the partial index places_food_featured_ix.
    return sql`AND (p.is_featured OR cardinality(p.youtube_video_ids) > 0)`;
  }

  /** The BST calendar date of the latest successful import, or null when there is none. Not memoized. */
  async function readDatasetVersion(): Promise<string | null> {
    const [row] = await sql<{ dataset_version: string | null }[]>`
      SELECT to_char(max(finished_at) AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS dataset_version
      FROM sync_runs
      WHERE status = 'succeeded'`;
    return row?.dataset_version ?? null;
  }

  return {
    readDatasetVersion,

    /** `readDatasetVersion`, memoized per epoch value. */
    async getDatasetVersion(epoch: number): Promise<string | null> {
      if (datasetMemo?.epoch === epoch) return datasetMemo.value;
      const value = await readDatasetVersion();
      if (value !== null) datasetMemo = { epoch, value };
      return value;
    },

    /** Returns up to cap + 1 rows so the caller can detect truncation. */
    async findPins(scope: PinScope, filters: PinFilters = {}): Promise<PinRow[]> {
      const order =
        scope.kind === "featured"
          ? sql`p.is_featured DESC, cardinality(p.youtube_video_ids) DESC, p.eff_name_en NULLS LAST, p.id`
          : sql`p.eff_name_en NULLS LAST, p.eff_name_bn NULLS LAST, p.id`;
      return await sql<PinRow[]>`
        SELECT p.id, p.district_id, p.upazila_id,
               p.eff_name_en AS name_en, p.eff_name_bn AS name_bn,
               p.category, p.source,
               ST_X(p.eff_geom) AS lng, ST_Y(p.eff_geom) AS lat,
               cardinality(p.youtube_video_ids) > 0 AS has_video,
               p.wikimedia_s3_keys ->> 0 AS thumb_s3_key
        FROM places p
        WHERE p.overlay_type = 'food' AND p.is_active AND NOT p.is_hidden
          ${scopeFragment(scope)}
          ${filters.category ? sql`AND p.category = ANY (${[...filters.category]}::text[])` : sql``}
          ${filters.has_video ? sql`AND cardinality(p.youtube_video_ids) > 0` : sql``}
        ORDER BY ${order}
        LIMIT ${pinCap(scope) + 1}`;
    },

    async findDetail(id: string): Promise<{ place: PlaceRow; photos: PhotoRow[]; videos: VideoRow[] } | null> {
      const [place] = await sql<PlaceRow[]>`
        SELECT p.id, p.district_id, gd.name_en AS district_name_en, gd.name_bn AS district_name_bn,
               p.upazila_id, gu.name_en AS upazila_name_en, gu.name_bn AS upazila_name_bn,
               ST_X(p.eff_geom) AS lng, ST_Y(p.eff_geom) AS lat,
               p.eff_name_en AS name_en, p.eff_name_bn AS name_bn, p.category, p.cuisines, p.tags,
               p.source, p.source_id, p.source_license, p.youtube_video_ids,
               to_char(p.updated_at AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD"T"HH24:MI:SS"+06:00"') AS updated_at
        FROM places p
        JOIN geo_districts gd ON gd.id = p.district_id
        LEFT JOIN geo_upazilas gu ON gu.id = p.upazila_id
        WHERE p.id = ${id} AND p.overlay_type = 'food' AND p.is_active AND NOT p.is_hidden`;
      if (!place) return null;

      const [photos, videos] = await Promise.all([
        sql<PhotoRow[]>`
          SELECT s3_key, width, height, source, author, license, license_url, source_page_url
          FROM place_photos WHERE place_id = ${id} ORDER BY sort_order, id`,
        // An empty array has no inferable parameter type, and needs no query.
        place.youtube_video_ids.length === 0
          ? Promise.resolve<VideoRow[]>([])
          : sql<VideoRow[]>`
              SELECT v.video_id, v.title, v.channel_id, c.title AS channel_title,
                     to_char(v.published_at AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD"T"HH24:MI:SS"+06:00"') AS published_at,
                     v.duration_seconds, m.start_seconds
              FROM unnest(${place.youtube_video_ids}::text[]) WITH ORDINALITY AS u(video_id, ord)
              JOIN youtube_videos v ON v.video_id = u.video_id
              JOIN youtube_channels c ON c.channel_id = v.channel_id
              JOIN video_place_matches m ON m.video_id = u.video_id AND m.place_id = ${id}
              ORDER BY u.ord`,
      ]);
      return { place, photos, videos };
    },
  };
}

export type FoodRepository = ReturnType<typeof createFoodRepository>;
