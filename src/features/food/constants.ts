import type { FoodCategory, FoodCuisine } from "./types";

export const FOOD_OVERLAY_SPEC = {
  id: "food" as const,
  pin_type: "food_poi" as const,
  time_binding: "none" as const,
  promote_id: "id" as const,
  default_local_port: 8002,
} as const;

export const FOOD_CATEGORIES: readonly FoodCategory[] = [
  "restaurant",
  "street_food",
  "cafe",
  "tea_stall",
  "sweets_bakery",
  "fast_food",
  "food_court",
  "dessert",
  "other",
] as const;

export const FOOD_CUISINES: readonly FoodCuisine[] = [
  "bangladeshi",
  "biryani_kacchi",
  "fish_seafood",
  "kebab_grill",
  "pitha",
  "mishti",
  "chinese_thai",
  "indian",
  "western",
  "other",
] as const;

export interface FoodCategoryMeta {
  label_en: string;
  label_bn: string;
  color: string;
}

export const FOOD_CATEGORY_META: Record<FoodCategory, FoodCategoryMeta> = {
  restaurant: { label_en: "Restaurant", label_bn: "রেস্তোরাঁ", color: "#e54d2e" },
  street_food: { label_en: "Street Food", label_bn: "স্ট্রিট ফুড", color: "#f97316" },
  cafe: { label_en: "Cafe", label_bn: "ক্যাফে", color: "#8b5cf6" },
  tea_stall: { label_en: "Tea Stall", label_bn: "চায়ের দোকান", color: "#10b981" },
  sweets_bakery: { label_en: "Sweets & Bakery", label_bn: "মিষ্টি ও বেকারি", color: "#f59e0b" },
  fast_food: { label_en: "Fast Food", label_bn: "ফাস্ট ফুড", color: "#ef4444" },
  food_court: { label_en: "Food Court", label_bn: "ফুড কোর্ট", color: "#06b6d4" },
  dessert: { label_en: "Dessert", label_bn: "ডেজার্ট", color: "#ec4899" },
  other: { label_en: "Other", label_bn: "অন্যান্য", color: "#64748b" },
};

export interface FoodCuisineMeta {
  label_en: string;
  label_bn: string;
}

export const FOOD_CUISINE_META: Record<FoodCuisine, FoodCuisineMeta> = {
  bangladeshi: { label_en: "Bangladeshi", label_bn: "বাংলাদেশি" },
  biryani_kacchi: { label_en: "Biryani & Kacchi", label_bn: "বিরিয়ানি ও কাচ্চি" },
  fish_seafood: { label_en: "Fish & Seafood", label_bn: "মাছ ও সামুদ্রিক খাবার" },
  kebab_grill: { label_en: "Kebab & Grill", label_bn: "কাবাব ও গ্রিল" },
  pitha: { label_en: "Pitha", label_bn: "পিঠা" },
  mishti: { label_en: "Mishti", label_bn: "মিষ্টি" },
  chinese_thai: { label_en: "Chinese & Thai", label_bn: "চাইনিজ ও থাই" },
  indian: { label_en: "Indian", label_bn: "ভারতীয়" },
  western: { label_en: "Western", label_bn: "ওয়েস্টার্ন" },
  other: { label_en: "Other", label_bn: "অন্যান্য" },
};

/**
 * Resolves the configured Food API base URL when live endpoints are connected.
 * Returns null when running strictly on local M0 contract mocks.
 */
export function getFoodApiBaseUrl(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_FOOD_API_BASE_URL ??
    process.env.FOOD_API_BASE_URL ??
    "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

/** Builds a privacy-enhanced YouTube nocookie embed URL with optional chapter offset. */
export function getYouTubeEmbedUrl(videoId: string, startSeconds: number | null = null): string {
  const base = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
  return startSeconds !== null && startSeconds > 0 ? `${base}?start=${Math.floor(startSeconds)}` : base;
}

/** Builds a Map deep-link URL for a specific Food POI. */
export function getFoodDeepLink(pinId: string, districtId?: string | null): string {
  const params = new URLSearchParams({ overlay: "food", pin: pinId });
  if (districtId) params.set("district", districtId);
  return `/?${params.toString()}`;
}
