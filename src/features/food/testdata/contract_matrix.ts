// The contract parity matrix (Guide §7.3 Slice 1.7): every route x status x code the Food API serves.
// api/tests/contract/parity_matrix.test.ts turns each row into one test case.
import { FoodPinDetailSchema, FoodPinsFeatureCollectionSchema } from "../contract/schemas";
import type { FoodErrorCode } from "../types";

/** The place the matrix expects to be seeded: in BD3026, a tea stall with a video, inside BBOX. */
export const PLACE_ID = "f00d7000-0000-4000-8000-000000000001";

const PINS = "/api/v1/pins?overlay=food";

interface Request {
  route: "pins" | "detail" | "any";
  path: string;
  /** Repeat the request with the first response's ETag in If-None-Match. */
  revalidate?: true;
  /** Serve the request from an app whose database cannot be reached. */
  databaseDown?: true;
}

export type MatrixRow = Request &
  (
    | { status: 200; body: typeof FoodPinsFeatureCollectionSchema | typeof FoodPinDetailSchema }
    | { status: 304 }
    | { status: 400 | 404 | 500; code: FoodErrorCode }
  );

const DISTRICT = `${PINS}&district_id=BD3026`;
const DETAIL = `/api/v1/pins/food/${PLACE_ID}`;
const UNKNOWN_ID = "f00d7000-0000-4000-8000-00000000ffff";

const collection = { route: "pins", status: 200, body: FoodPinsFeatureCollectionSchema } as const;

export const CONTRACT_MATRIX: readonly MatrixRow[] = [
  { ...collection, path: PINS }, // the featured set
  { ...collection, path: DISTRICT },
  { ...collection, path: `${PINS}&bbox=90.38,23.70,90.42,23.73` },
  { ...collection, path: `${DISTRICT}&category=tea_stall` },
  { ...collection, path: `${PINS}&has_video=true` },
  { route: "pins", path: DISTRICT, revalidate: true, status: 304 },
  { route: "pins", path: `${PINS}&district_id=BD9999`, status: 400, code: "INVALID_DISTRICT" },
  { route: "pins", path: `${PINS}&bbox=1,2,3`, status: 400, code: "INVALID_BBOX" },
  { route: "pins", path: `${PINS}&category=pizza`, status: 400, code: "INVALID_CATEGORY" },
  { route: "pins", path: "/api/v1/pins?overlay=news", status: 400, code: "INVALID_QUERY" },

  { route: "detail", path: DETAIL, status: 200, body: FoodPinDetailSchema },
  { route: "detail", path: DETAIL, revalidate: true, status: 304 },
  { route: "detail", path: "/api/v1/pins/food/not-a-uuid", status: 400, code: "INVALID_ID" },
  { route: "detail", path: `/api/v1/pins/food/${UNKNOWN_ID}`, status: 404, code: "FOOD_PLACE_NOT_FOUND" },

  { route: "any", path: "/api/v1/unknown", status: 404, code: "NOT_FOUND" },
  { route: "any", path: DETAIL, databaseDown: true, status: 500, code: "INTERNAL_ERROR" },
];
