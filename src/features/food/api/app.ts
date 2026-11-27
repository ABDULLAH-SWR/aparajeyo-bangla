import crypto from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { sql } from "./db";
import { isImgproxyConfigured, signImgproxyUrl } from "./imgproxy";
import { safeValkeyGet, safeValkeySet, snapBboxToZ12Key } from "./valkey";
import type {
  FoodCategory,
  FoodCuisine,
  FoodPhoto,
  FoodPinDetail,
  FoodPinFeature,
  FoodPinsFeatureCollection,
  FoodVideo,
  PlaceSource,
} from "../types";

const NATIONAL_CAP = 2000;
const SCOPED_CAP = 5000;

const VALID_CATEGORIES = new Set<string>([
  "restaurant",
  "street_food",
  "cafe",
  "tea_stall",
  "sweets_bakery",
  "fast_food",
  "food_court",
  "dessert",
  "other",
]);

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function computeEtag(body: string): string {
  return `W/"${crypto.createHash("sha256").update(body).digest("hex").slice(0, 20)}"`;
}

function formatBstIso(dateVal: Date | string): string {
  const ms = typeof dateVal === "string" ? Date.parse(dateVal) : dateVal.getTime();
  const bst = new Date(ms + 6 * 3600 * 1000);
  return bst.toISOString().replace(/\.\d{3}Z$/, "+06:00");
}

function formatOsmAddress(tags: Record<string, unknown>): string | null {
  if (typeof tags["addr:full"] === "string" && tags["addr:full"].trim()) {
    return tags["addr:full"].trim();
  }
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

const pinsQuerySchema = z.object({
  overlay: z.literal("food"),
  district_id: z.string().optional(),
  bbox: z.string().optional(),
  category: z.string().optional(),
  has_video: z.enum(["true", "false"]).optional(),
});

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = new Hono()
  .use(
    "*",
    cors({
      origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "If-None-Match"],
      exposeHeaders: ["ETag", "X-Cache", "X-Response-Time-Ms"],
    })
  )
  .get(
    "/api/v1/pins",
    zValidator("query", pinsQuerySchema, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: { code: "INVALID_QUERY", message: "Query parameter overlay=food is required." } },
          400
        );
      }
    }),
    async (c) => {
      const start = performance.now();
      const { district_id, bbox: bboxRaw, category: categoryRaw, has_video } = c.req.valid("query");

      const districtId = district_id?.trim() || null;
      if (districtId) {
        const [exists] = await sql`SELECT 1 FROM geo_districts WHERE id = ${districtId} LIMIT 1`;
        if (!exists) {
          return c.json(
            { error: { code: "INVALID_DISTRICT", message: `Unknown district_id: ${districtId}` } },
            400
          );
        }
      }

      let bbox: [number, number, number, number] | null = null;
      if (bboxRaw) {
        const parts = bboxRaw.split(",").map(Number);
        if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n)) || parts[0] >= parts[2] || parts[1] >= parts[3]) {
          return c.json(
            { error: { code: "INVALID_BBOX", message: "bbox must be minLng,minLat,maxLng,maxLat." } },
            400
          );
        }
        bbox = [parts[0], parts[1], parts[2], parts[3]];
      }

      let categories: FoodCategory[] | null = null;
      if (categoryRaw) {
        const split = categoryRaw.split(",").map((s) => s.trim()).filter(Boolean);
        if (split.length === 0 || split.some((cat) => !VALID_CATEGORIES.has(cat))) {
          return c.json(
            {
              error: {
                code: "INVALID_CATEGORY",
                message: `category must be one or more of: ${[...VALID_CATEGORIES].join(", ")}`,
              },
            },
            400
          );
        }
        categories = split as FoodCategory[];
      }

      const hasVideoOnly = has_video === "true";
      const version = (await safeValkeyGet("food:dataset_version")) || new Date().toISOString().slice(0, 10);
      const scopeKey = districtId
        ? districtId
        : bbox
          ? `bbox:${snapBboxToZ12Key(bbox[0], bbox[1], bbox[2], bbox[3])}`
          : "featured";
      const filterHash =
        !categories && !hasVideoOnly
          ? "all"
          : crypto
              .createHash("sha1")
              .update(`${(categories ?? []).join(",")}|${hasVideoOnly}`)
              .digest("hex")
              .slice(0, 10);
      const cacheKey = `food:pins:v${version}:${scopeKey}:${filterHash}`;

      // Fast Valkey cache hit when not querying unaligned raw bbox beyond tile cache
      if (!bbox) {
        const cachedRaw = await safeValkeyGet(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as { etag: string; body: string };
          const elapsed = (performance.now() - start).toFixed(1);
          if (c.req.header("if-none-match") === cached.etag) {
            return c.body(null, 304, { ETag: cached.etag, "X-Cache": "HIT", "X-Response-Time-Ms": elapsed });
          }
          return c.text(cached.body, 200, {
            "Content-Type": "application/json; charset=utf-8",
            ETag: cached.etag,
            "Cache-Control": "public, max-age=60",
            "X-Cache": "HIT",
            "X-Response-Time-Ms": elapsed,
          });
        }
      }

      const isScoped = Boolean(districtId || bbox);
      const cap = isScoped ? SCOPED_CAP : NATIONAL_CAP;

      const [runRow] = await sql`SELECT dataset_version FROM sync_runs ORDER BY id DESC LIMIT 1`;
      const datasetVersion: string = runRow?.dataset_version ?? version;

      const rows = await sql`
        SELECT
          id::text AS id,
          district_id,
          upazila_id,
          category,
          source,
          wikimedia_s3_keys,
          youtube_video_ids,
          ST_X(COALESCE(geom_override, geom)) AS eff_lng,
          ST_Y(COALESCE(geom_override, geom)) AS eff_lat,
          COALESCE(name_en_override, name_en) AS eff_name_en,
          COALESCE(name_bn_override, name_bn) AS eff_name_bn
        FROM places
        WHERE overlay_type = 'food'
          AND is_active
          AND NOT is_hidden
          ${districtId ? sql`AND district_id = ${districtId}` : sql``}
          ${bbox ? sql`AND ST_Intersects(COALESCE(geom_override, geom), ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}, 4326))` : sql``}
          ${categories ? sql`AND category = ANY(${categories})` : sql``}
          ${hasVideoOnly ? sql`AND cardinality(youtube_video_ids) > 0` : sql``}
        ORDER BY
          (cardinality(youtube_video_ids) > 0) DESC,
          (jsonb_array_length(wikimedia_s3_keys) > 0) DESC,
          is_featured DESC,
          (name_bn IS NOT NULL AND name_en IS NOT NULL) DESC,
          updated_at DESC,
          id ASC
        LIMIT ${cap + 1}
      `;

      const truncated = rows.length > cap;
      const sliced = truncated ? rows.slice(0, cap) : rows;

      const features: FoodPinFeature[] = sliced.map((r) => {
        const s3Keys = Array.isArray(r.wikimedia_s3_keys) ? (r.wikimedia_s3_keys as string[]) : [];
        const thumbUrl = s3Keys.length > 0 ? signImgproxyUrl(s3Keys[0], 320) : null;
        const videoIds = Array.isArray(r.youtube_video_ids) ? (r.youtube_video_ids as string[]) : [];
        return {
          type: "Feature",
          id: String(r.id),
          geometry: {
            type: "Point",
            coordinates: [Number(r.eff_lng), Number(r.eff_lat)],
          },
          properties: {
            id: String(r.id),
            pin_type: "food_poi",
            district_id: String(r.district_id).trim(),
            upazila_id: r.upazila_id ? String(r.upazila_id).trim() : null,
            name_en: (r.eff_name_en as string | null) ?? null,
            name_bn: (r.eff_name_bn as string | null) ?? null,
            category: r.category as FoodCategory,
            has_video: videoIds.length > 0,
            thumbnail_url: thumbUrl,
            source: r.source as PlaceSource,
          },
        };
      });

      const payload: FoodPinsFeatureCollection = {
        type: "FeatureCollection",
        metadata: {
          overlay: "food",
          district_id: districtId,
          total_count: features.length,
          truncated,
          dataset_version: datasetVersion,
          attribution_text: "© OpenStreetMap contributors, Overture Maps Foundation",
        },
        features,
      };

      const bodyStr = JSON.stringify(payload);
      const etag = computeEtag(bodyStr);
      if (!bbox) {
        await safeValkeySet(cacheKey, JSON.stringify({ etag, body: bodyStr }), 86400);
      }

      const elapsed = (performance.now() - start).toFixed(1);
      if (c.req.header("if-none-match") === etag) {
        return c.body(null, 304, { ETag: etag, "X-Cache": "MISS", "X-Response-Time-Ms": elapsed });
      }

      return c.text(bodyStr, 200, {
        "Content-Type": "application/json; charset=utf-8",
        ETag: etag,
        "Cache-Control": "public, max-age=60",
        "X-Cache": "MISS",
        "X-Response-Time-Ms": elapsed,
      });
    }
  )
  .get("/api/v1/pins/food/:id", async (c) => {
    const start = performance.now();
    const id = c.req.param("id");
    if (!UUID_V4_RE.test(id)) {
      return c.json({ error: { code: "INVALID_ID", message: "Place ID must be a valid UUID v4." } }, 400);
    }

    const detailCacheKey = `food:detail:${id}`;
    const cachedRaw = await safeValkeyGet(detailCacheKey);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as { etag: string; body: string };
      const elapsed = (performance.now() - start).toFixed(1);
      if (c.req.header("if-none-match") === cached.etag) {
        return c.body(null, 304, { ETag: cached.etag, "X-Cache": "HIT", "X-Response-Time-Ms": elapsed });
      }
      return c.text(cached.body, 200, {
        "Content-Type": "application/json; charset=utf-8",
        ETag: cached.etag,
        "Cache-Control": "public, max-age=300",
        "X-Cache": "HIT",
        "X-Response-Time-Ms": elapsed,
      });
    }

    const [row] = await sql`
      SELECT
        p.id::text AS id,
        p.district_id,
        d.name_en AS district_name_en,
        d.name_bn AS district_name_bn,
        p.upazila_id,
        u.name_en AS upazila_name_en,
        u.name_bn AS upazila_name_bn,
        ST_X(COALESCE(p.geom_override, p.geom)) AS eff_lng,
        ST_Y(COALESCE(p.geom_override, p.geom)) AS eff_lat,
        COALESCE(p.name_en_override, p.name_en) AS eff_name_en,
        COALESCE(p.name_bn_override, p.name_bn) AS eff_name_bn,
        p.category,
        p.cuisines,
        p.tags,
        p.source,
        p.source_id,
        p.source_license,
        p.updated_at
      FROM places p
      JOIN geo_districts d ON d.id = p.district_id
      LEFT JOIN geo_upazilas u ON u.id = p.upazila_id
      WHERE p.id = ${id}::uuid AND p.overlay_type = 'food' AND p.is_active AND NOT p.is_hidden
      LIMIT 1
    `;

    if (!row) {
      return c.json(
        { error: { code: "FOOD_PLACE_NOT_FOUND", message: "No active food place found for the given ID." } },
        404
      );
    }

    const photoRows = await sql`
      SELECT s3_key, source, author, license, license_url, source_page_url, width, height
      FROM place_photos
      WHERE place_id = ${id}::uuid
      ORDER BY sort_order ASC
    `;

    const photos: FoodPhoto[] = [];
    for (const p of photoRows) {
      const thumbUrl = signImgproxyUrl(String(p.s3_key), 320);
      const fullUrl = signImgproxyUrl(String(p.s3_key), 1280);
      if (!thumbUrl || !fullUrl) continue;
      photos.push({
        thumb_url: thumbUrl,
        url: fullUrl,
        width: Number(p.width),
        height: Number(p.height),
        source: p.source as "wikimedia" | "ugc",
        credit: {
          author: String(p.author),
          license: String(p.license),
          license_url: String(p.license_url),
          source_page_url: String(p.source_page_url),
        },
      });
    }

    const videoRows = await sql`
      SELECT v.video_id, v.title, v.channel_id, c.title AS channel_title,
             v.published_at, v.duration_seconds, m.start_seconds
      FROM video_place_matches m
      JOIN youtube_videos v ON v.video_id = m.video_id
      JOIN youtube_channels c ON c.channel_id = v.channel_id
      WHERE m.place_id = ${id}::uuid
        AND m.status IN ('auto_approved', 'approved')
        AND v.is_available
      ORDER BY m.confidence DESC
    `;

    const videos: FoodVideo[] = videoRows.map((v) => ({
      video_id: String(v.video_id),
      title: String(v.title),
      channel_id: String(v.channel_id),
      channel_title: String(v.channel_title),
      published_at: formatBstIso(v.published_at as Date | string),
      duration_seconds: Number(v.duration_seconds),
      start_seconds: v.start_seconds !== null ? Number(v.start_seconds) : null,
    }));

    const tags = (row.tags ?? {}) as Record<string, unknown>;
    const cuisines = (Array.isArray(row.cuisines) && row.cuisines.length > 0 ? row.cuisines : ["other"]) as FoodCuisine[];
    const source = row.source as PlaceSource;

    const detail: FoodPinDetail = {
      id: String(row.id),
      pin_type: "food_poi",
      district_id: String(row.district_id).trim(),
      district_name_en: String(row.district_name_en),
      district_name_bn: String(row.district_name_bn),
      upazila_id: row.upazila_id ? String(row.upazila_id).trim() : null,
      upazila_name_en: (row.upazila_name_en as string | null) ?? null,
      upazila_name_bn: (row.upazila_name_bn as string | null) ?? null,
      coordinates: [Number(row.eff_lng), Number(row.eff_lat)],
      name_en: (row.eff_name_en as string | null) ?? null,
      name_bn: (row.eff_name_bn as string | null) ?? null,
      category: row.category as FoodCategory,
      cuisines,
      description_en: null,
      description_bn: null,
      address_en: formatOsmAddress(tags),
      address_bn: null,
      opening_hours: typeof tags.opening_hours === "string" ? tags.opening_hours : null,
      phone:
        typeof tags.phone === "string"
          ? tags.phone
          : typeof tags["contact:phone"] === "string"
            ? tags["contact:phone"]
            : null,
      website:
        typeof tags.website === "string"
          ? tags.website
          : typeof tags["contact:website"] === "string"
            ? tags["contact:website"]
            : null,
      photos,
      youtube_video_ids: videos.map((v) => v.video_id),
      videos,
      source,
      source_id: String(row.source_id),
      osm_attribution: {
        text: source === "osm" ? "© OpenStreetMap contributors" : "© Overture Maps Foundation",
        url: source === "osm" ? "https://www.openstreetmap.org/copyright" : "https://overturemaps.org/",
        license: String(row.source_license || (source === "osm" ? "ODbL-1.0" : "CDLA-Permissive-2.0")),
      },
      rating: null,
      review_count: null,
      updated_at: formatBstIso(row.updated_at as Date | string),
    };

    const bodyStr = JSON.stringify(detail);
    const etag = computeEtag(bodyStr);
    await safeValkeySet(detailCacheKey, JSON.stringify({ etag, body: bodyStr }), 86400);

    const elapsed = (performance.now() - start).toFixed(1);
    if (c.req.header("if-none-match") === etag) {
      return c.body(null, 304, { ETag: etag, "X-Cache": "MISS", "X-Response-Time-Ms": elapsed });
    }

    return c.text(bodyStr, 200, {
      "Content-Type": "application/json; charset=utf-8",
      ETag: etag,
      "Cache-Control": "public, max-age=300",
      "X-Cache": "MISS",
      "X-Response-Time-Ms": elapsed,
    });
  })
  .get("/api/v1/food/health", async (c) => {
    const [stats] = await sql`
      SELECT
        COUNT(*)::int AS total_places,
        COUNT(*) FILTER (WHERE is_active AND NOT is_hidden)::int AS active_places,
        COUNT(DISTINCT district_id) FILTER (WHERE is_active AND NOT is_hidden)::int AS districts_covered
      FROM places
      WHERE overlay_type = 'food'
    `;
    const [photoRow] = await sql`SELECT COUNT(*)::int AS cnt FROM place_photos`;
    const [videoRow] = await sql`
      SELECT COUNT(*)::int AS cnt FROM video_place_matches WHERE status IN ('auto_approved', 'approved')
    `;
    const [lastRun] = await sql`SELECT dataset_version, finished_at FROM sync_runs ORDER BY id DESC LIMIT 1`;

    return c.json({
      status: "ok" as const,
      service: "aparajeyo-food-api" as const,
      dataset_version: (lastRun?.dataset_version as string | null) ?? null,
      last_sync_at: lastRun?.finished_at ? formatBstIso(lastRun.finished_at as Date | string) : null,
      total_places: Number(stats?.total_places ?? 0),
      active_places: Number(stats?.active_places ?? 0),
      districts_covered: Number(stats?.districts_covered ?? 0),
      total_photos: Number(photoRow?.cnt ?? 0),
      total_videos: Number(videoRow?.cnt ?? 0),
      imgproxy_enabled: isImgproxyConfigured(),
    });
  })
  .notFound((c) =>
    c.json({ error: { code: "FOOD_PLACE_NOT_FOUND", message: `Route not found: ${c.req.path}` } }, 404)
  )
  .onError((err, c) => {
    // Detail stays server-side: driver messages can expose hosts and SQL.
    console.error("[food-api] unhandled error", { err, request_id: crypto.randomUUID() });
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error." } }, 500);
  });

export type FoodApiApp = typeof app;
export default app;
