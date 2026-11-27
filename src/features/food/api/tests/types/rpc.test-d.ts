import { hc, type InferResponseType } from "hono/client";
import { expectTypeOf, test } from "vitest";
import type { FoodPinDetail, FoodPinsFeatureCollection } from "../../../types";
import type { FoodApiApp } from "../../app";

const client = hc<FoodApiApp>("http://food.example.test");

test("the pins route is typed as the contract collection", () => {
  expectTypeOf<InferResponseType<typeof client.api.v1.pins.$get, 200>>().toEqualTypeOf<FoodPinsFeatureCollection>();
});

test("the detail route is typed as the contract detail", () => {
  expectTypeOf<
    InferResponseType<(typeof client.api.v1.pins.food)[":id"]["$get"], 200>
  >().toEqualTypeOf<FoodPinDetail>();
});
