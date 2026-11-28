// Zero drift (Guide §7.2): each contract type is exactly the type its zod schema produces.
import { expectTypeOf, test } from "vitest";
import type { z } from "zod";
import type * as schemas from "../../../contract/schemas";
import type * as contract from "../../../types";

test("FoodPinProperties", () => {
  expectTypeOf<z.infer<typeof schemas.FoodPinPropertiesSchema>>().toEqualTypeOf<contract.FoodPinProperties>();
});

test("FoodPinFeature", () => {
  expectTypeOf<z.infer<typeof schemas.FoodPinFeatureSchema>>().toEqualTypeOf<contract.FoodPinFeature>();
});

test("FoodPinsMetadata", () => {
  expectTypeOf<z.infer<typeof schemas.FoodPinsMetadataSchema>>().toEqualTypeOf<contract.FoodPinsMetadata>();
});

test("FoodPinsFeatureCollection", () => {
  expectTypeOf<z.infer<typeof schemas.FoodPinsFeatureCollectionSchema>>().toEqualTypeOf<contract.FoodPinsFeatureCollection>();
});

test("FoodPhotoCredit", () => {
  expectTypeOf<z.infer<typeof schemas.FoodPhotoCreditSchema>>().toEqualTypeOf<contract.FoodPhotoCredit>();
});

test("FoodPhoto", () => {
  expectTypeOf<z.infer<typeof schemas.FoodPhotoSchema>>().toEqualTypeOf<contract.FoodPhoto>();
});

test("FoodVideo", () => {
  expectTypeOf<z.infer<typeof schemas.FoodVideoSchema>>().toEqualTypeOf<contract.FoodVideo>();
});

test("OsmAttribution", () => {
  expectTypeOf<z.infer<typeof schemas.OsmAttributionSchema>>().toEqualTypeOf<contract.OsmAttribution>();
});

test("FoodPinDetail", () => {
  expectTypeOf<z.infer<typeof schemas.FoodPinDetailSchema>>().toEqualTypeOf<contract.FoodPinDetail>();
});

test("ApiErrorResponse", () => {
  expectTypeOf<z.infer<typeof schemas.ApiErrorResponseSchema>>().toEqualTypeOf<contract.ApiErrorResponse>();
});
