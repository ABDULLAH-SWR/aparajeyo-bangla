export const FOOD_CATEGORIES = [
  "restaurant", "street_food", "cafe", "tea_stall", "sweets_bakery",
  "fast_food", "food_court", "dessert", "other",
] as const;

export const FOOD_CUISINES = [
  "bangladeshi", "biryani_kacchi", "fish_seafood", "kebab_grill", "pitha",
  "mishti", "chinese_thai", "indian", "western", "other",
] as const;

export const PLACE_SOURCES = ["osm", "overture"] as const;

/** "ugc" is reserved for Phase 4. The SQL CHECK accepts only 'wikimedia' (R13, contract C11). */
export const FOOD_PHOTO_SOURCES = ["wikimedia", "ugc"] as const;

export const FOOD_ERROR_CODES = [
  "INVALID_ID", "INVALID_DISTRICT", "INVALID_BBOX", "INVALID_CATEGORY", "INVALID_QUERY",
  "FOOD_PLACE_NOT_FOUND", "NOT_FOUND", "INTERNAL_ERROR",
] as const;
