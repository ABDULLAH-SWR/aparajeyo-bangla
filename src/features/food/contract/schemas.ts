import { z } from "zod";
import { FOOD_CATEGORIES, FOOD_CUISINES, FOOD_ERROR_CODES, FOOD_PHOTO_SOURCES, PLACE_SOURCES } from "./enums";

const ADM2 = /^BD\d{4}$/;
const ADM3 = /^BD\d{8}$/;
const BST_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?\+06:00$/;
const YT_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

const hasAName = (v: { name_en: string | null; name_bn: string | null }) => v.name_en !== null || v.name_bn !== null;
const NAME_RULE = { message: "at least one of name_en / name_bn must be non-null" };

export const LngLatSchema = z.tuple([z.number().gte(88).lte(93), z.number().gte(20.5).lte(26.8)]);

export const FoodPinPropertiesSchema = z.object({
  id: z.uuidv4(),
  pin_type: z.literal("food_poi"),
  district_id: z.string().regex(ADM2),
  upazila_id: z.string().regex(ADM3).nullable(),
  name_en: z.string().min(1).nullable(),
  name_bn: z.string().min(1).nullable(),
  category: z.enum(FOOD_CATEGORIES),
  has_video: z.boolean(),
  thumbnail_url: z.url().nullable(),
  source: z.enum(PLACE_SOURCES),
}).refine(hasAName, NAME_RULE);

export const FoodPinFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.uuidv4(),
  geometry: z.object({ type: z.literal("Point"), coordinates: LngLatSchema }),
  properties: FoodPinPropertiesSchema,
}).refine((f) => f.id === f.properties.id, { message: "feature.id must equal properties.id" });

export const FoodPinsMetadataSchema = z.object({
  overlay: z.literal("food"),
  district_id: z.string().regex(ADM2).nullable(),
  total_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  dataset_version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attribution_text: z.string().min(1),
});

export const FoodPinsFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  metadata: FoodPinsMetadataSchema,
  features: z.array(FoodPinFeatureSchema),
}).refine((c) => c.metadata.total_count === c.features.length, { message: "total_count must equal features.length" });

export const FoodPhotoCreditSchema = z.object({
  author: z.string().min(1),
  license: z.string().min(1),
  license_url: z.url(),
  source_page_url: z.url(),
});

export const FoodPhotoSchema = z.object({
  thumb_url: z.url(),
  url: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  source: z.enum(FOOD_PHOTO_SOURCES),
  credit: FoodPhotoCreditSchema,
});

export const FoodVideoSchema = z.object({
  video_id: z.string().regex(YT_VIDEO_ID),
  title: z.string().min(1),
  channel_id: z.string().regex(YT_CHANNEL_ID),
  channel_title: z.string().min(1),
  published_at: z.string().regex(BST_ISO),
  duration_seconds: z.number().int().nonnegative(),
  start_seconds: z.number().int().nonnegative().nullable(),
});

export const OsmAttributionSchema = z.object({
  text: z.string().min(1),
  url: z.url(),
  license: z.string().min(1),
});

export const FoodPinDetailSchema = z.object({
  id: z.uuidv4(),
  pin_type: z.literal("food_poi"),
  district_id: z.string().regex(ADM2),
  district_name_en: z.string().min(1),
  district_name_bn: z.string().min(1),
  upazila_id: z.string().regex(ADM3).nullable(),
  upazila_name_en: z.string().nullable(),
  upazila_name_bn: z.string().nullable(),
  coordinates: LngLatSchema,
  name_en: z.string().min(1).nullable(),
  name_bn: z.string().min(1).nullable(),
  category: z.enum(FOOD_CATEGORIES),
  cuisines: z.array(z.enum(FOOD_CUISINES)).min(1),
  description_en: z.string().nullable(),
  description_bn: z.string().nullable(),
  address_en: z.string().nullable(),
  address_bn: z.string().nullable(),
  opening_hours: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  photos: z.array(FoodPhotoSchema),
  youtube_video_ids: z.array(z.string().regex(YT_VIDEO_ID)),
  videos: z.array(FoodVideoSchema),
  source: z.enum(PLACE_SOURCES),
  source_id: z.string().min(1),
  osm_attribution: OsmAttributionSchema,
  rating: z.number().nullable(),
  review_count: z.number().int().nonnegative().nullable(),
  updated_at: z.string().regex(BST_ISO),
})
  .refine(hasAName, NAME_RULE)
  .refine((d) => d.videos.map((v) => v.video_id).join() === d.youtube_video_ids.join(), {
    message: "videos must match youtube_video_ids order",
  });

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(FOOD_ERROR_CODES),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
