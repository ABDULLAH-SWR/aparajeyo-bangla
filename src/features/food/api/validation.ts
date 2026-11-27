// Query and parameter validation (Guide Appendix B.3).
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { FOOD_CATEGORIES } from "../contract/enums";
import { errorBody, type FoodErrorCode } from "./errors";

const lng = z.number().gte(87.5).lte(93.5);
const lat = z.number().gte(20.0).lte(27.0);
const MAX_SPAN_DEG = 2.0;

const parseBbox = (s: string): number[] => s.split(",").map((p) => (p.trim() === "" ? Number.NaN : Number(p)));

const splitCsv = (s: string): string[] => s.split(",").map((p) => p.trim()).filter((p) => p !== "");
const sortUnique = <T extends string>(xs: T[]): T[] => [...new Set(xs)].sort();

const BboxSchema = z
  .tuple([lng, lat, lng, lat])
  .refine(([x0, y0, x1, y1]) => x0 < x1 && y0 < y1, "min must be < max")
  .refine(([x0, y0, x1, y1]) => x1 - x0 <= MAX_SPAN_DEG && y1 - y0 <= MAX_SPAN_DEG, "span too large");

export const makePinsQuerySchema = (districtIds: ReadonlySet<string>) =>
  z
    .object({
      overlay: z.literal("food"),
      district_id: z.string().refine((v) => districtIds.has(v), "unknown district").optional(),
      bbox: z.string().transform(parseBbox).pipe(BboxSchema).optional(),
      category: z
        .string()
        .transform(splitCsv)
        .pipe(z.array(z.enum(FOOD_CATEGORIES)).min(1))
        .transform(sortUnique)
        .optional(),
      has_video: z.stringbool().optional(),
    })
    .refine((q) => !(q.district_id !== undefined && q.bbox !== undefined), {
      path: ["scope"],
      message: "district_id and bbox are mutually exclusive",
    });

const CODE_BY_FIELD: Readonly<Record<string, FoodErrorCode>> = {
  district_id: "INVALID_DISTRICT",
  bbox: "INVALID_BBOX",
  category: "INVALID_CATEGORY",
};

export const detailParamValidator = zValidator("param", z.object({ id: z.uuidv4() }), (result, c) => {
  if (!result.success) return c.json(errorBody("INVALID_ID"), 400);
});

export const pinsQueryValidator = (schema: ReturnType<typeof makePinsQuerySchema>) =>
  zValidator("query", schema, (result, c) => {
    if (!result.success) {
      const field = String(result.error.issues[0]?.path[0] ?? "");
      return c.json(errorBody(CODE_BY_FIELD[field] ?? "INVALID_QUERY"), 400);
    }
  });
