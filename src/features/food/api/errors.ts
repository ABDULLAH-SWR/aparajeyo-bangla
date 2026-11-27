import type { FOOD_ERROR_CODES } from "../contract/enums";

export type FoodErrorCode = (typeof FOOD_ERROR_CODES)[number];

// Guide Appendix B.4.
const MESSAGES: Readonly<Record<FoodErrorCode, string>> = {
  INVALID_ID: "The place ID must be a UUID.",
  INVALID_DISTRICT: "district_id must be a known 6-character ADM2 P-code.",
  INVALID_BBOX: "bbox must be minLng,minLat,maxLng,maxLat inside Bangladesh with each span at most 2 degrees.",
  INVALID_CATEGORY: "category must be one or more comma-separated FoodCategory values.",
  INVALID_QUERY:
    'Invalid query: overlay must be "food", has_video must be a boolean, and district_id and bbox cannot be combined.',
  FOOD_PLACE_NOT_FOUND: "No food place found for the given ID.",
  NOT_FOUND: "Route not found.",
  INTERNAL_ERROR: "Internal server error.",
};

export const errorBody = (code: FoodErrorCode) => ({ error: { code, message: MESSAGES[code] } });
