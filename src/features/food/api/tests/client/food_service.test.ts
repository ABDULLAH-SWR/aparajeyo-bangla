// Seam S9: the public client, wired to the real application.
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { FoodPinDetailSchema, FoodPinsFeatureCollectionSchema } from "../../../contract/schemas";
import { createFoodService, FoodApiError } from "../../../foodService";
import type { FoodCategory } from "../../../types";
import { createTestApp, type TestApp } from "../support/app";
import { DHAKA, insertImportRun, insertPlace } from "../support/fixtures";
import { createFileDb, type FileDb } from "../support/pg";

const BASE_URL = "http://food.example.test";

let db: FileDb;
let t: TestApp;
let zinda: string;

beforeAll(async () => {
  db = await createFileDb();
  zinda = await insertPlace(db.sql, { district_id: DHAKA, name_en: "Zinda Kebab" });
  await insertPlace(db.sql, { district_id: DHAKA, name_en: "Anna Sweets", category: "cafe" });
  await insertImportRun(db.sql);
  t = createTestApp({ databaseUrl: db.url });
});

afterAll(async () => {
  await t.close();
  await db.drop();
});

test("getFoodPins returns the contract collection the API serves", async () => {
  const service = createFoodService({ baseUrl: BASE_URL, fetch: t.app.fetch });

  const pins = await service.getFoodPins({ districtId: DHAKA });

  const res = await t.app.request("/api/v1/pins?overlay=food&district_id=BD3026");
  const body = FoodPinsFeatureCollectionSchema.parse(await res.json());
  expect(pins).toEqual(body);
  expect(pins.features.map((f) => f.properties.name_en)).toEqual(["Anna Sweets", "Zinda Kebab"]);
});

/** The real application, with its 200 bodies edited in transit. */
const tampered = (edit: (body: object) => object) => async (request: Request) => {
  const res = await t.app.fetch(request);
  return Response.json(edit((await res.json()) as object));
};

test("getFoodPins rejects a 200 body that breaks the contract", async () => {
  const fetch = tampered((body) => ({ ...body, metadata: { overlay: "news" } }));
  const service = createFoodService({ baseUrl: BASE_URL, fetch });

  await expect(service.getFoodPins({ districtId: DHAKA })).rejects.toMatchObject({ name: "ZodError" });
});

/** The real application, recording each exchange. */
function recordingFetch() {
  const exchanges: Array<{ path: string; ifNoneMatch: string | null; status: number; etag: string | null }> = [];
  const fetch = async (request: Request) => {
    const ifNoneMatch = request.headers.get("If-None-Match");
    const res = await t.app.fetch(request);
    const { pathname, search } = new URL(request.url);
    exchanges.push({ path: pathname + search, ifNoneMatch, status: res.status, etag: res.headers.get("ETag") });
    return res;
  };
  return { fetch, exchanges };
}

test("a repeated call revalidates with If-None-Match and returns the cached body on 304", async () => {
  const { fetch, exchanges } = recordingFetch();
  const service = createFoodService({ baseUrl: BASE_URL, fetch });

  const first = await service.getFoodPins({ districtId: DHAKA });
  const second = await service.getFoodPins({ districtId: DHAKA });

  expect(second).toEqual(first);
  expect(exchanges.map((e) => [e.ifNoneMatch, e.status])).toEqual([
    [null, 200],
    [exchanges[0]!.etag, 304],
  ]);
  expect(exchanges[0]!.etag).toMatch(/^W\//);
});

test("on a server, two service instances share no cache entries", async () => {
  expect(typeof window).toBe("undefined");
  const { fetch, exchanges } = recordingFetch();
  const one = createFoodService({ baseUrl: BASE_URL, fetch });
  const other = createFoodService({ baseUrl: BASE_URL, fetch });

  await one.getFoodPins({ districtId: DHAKA });
  await other.getFoodPins({ districtId: DHAKA });

  expect(exchanges.map((e) => [e.ifNoneMatch, e.status])).toEqual([
    [null, 200],
    [null, 200],
  ]);
});

test("a 304 for an evicted entry is refetched without If-None-Match", async () => {
  const recorder = recordingFetch();
  // Stands in for an intermediary that still holds a tag the client has evicted.
  let staleTag: string | null = null;
  const fetch = async (request: Request) => {
    if (staleTag !== null) {
      request = new Request(request, { headers: { "If-None-Match": staleTag } });
      staleTag = null;
    }
    return recorder.fetch(request);
  };
  const service = createFoodService({ baseUrl: BASE_URL, fetch, cacheCapacity: 1 });

  const first = await service.getFoodPins({ districtId: DHAKA });
  await service.getFoodPinDetail(zinda); // evicts the pins entry
  const tag = recorder.exchanges[0]!.etag;
  staleTag = tag;
  const third = await service.getFoodPins({ districtId: DHAKA });

  expect(third).toEqual(first);
  expect(recorder.exchanges.slice(2).map((e) => [e.ifNoneMatch, e.status])).toEqual([
    [tag, 304],
    [null, 200],
  ]);
});

test("the cache evicts the least recently used entry", async () => {
  const { fetch, exchanges } = recordingFetch();
  const service = createFoodService({ baseUrl: BASE_URL, fetch, cacheCapacity: 2 });
  const a = () => service.getFoodPins({ districtId: DHAKA });
  const b = () => service.getFoodPinDetail(zinda);
  const c = () => service.getFoodPins({ districtId: DHAKA, categories: ["cafe"] });

  await a();
  await b();
  await a(); // b is now the least recently used
  await c(); // so b is the one evicted
  await a();
  await b();

  expect(exchanges.slice(4).map((e) => e.status)).toEqual([304, 200]);
});

test.each([
  ["an unknown UUID", "00000000-0000-4000-8000-000000000000", "FOOD_PLACE_NOT_FOUND", 404],
  // The slash must stay inside the ID segment, or the request lands on another route.
  ["an ID that is not a UUID", "not/a-uuid", "INVALID_ID", 400],
])("getFoodPinDetail maps %s to the API's error code", async (_label, id, code, status) => {
  const service = createFoodService({ baseUrl: BASE_URL, fetch: t.app.fetch });

  const call = service.getFoodPinDetail(id);

  await expect(call).rejects.toBeInstanceOf(FoodApiError);
  await expect(call).rejects.toMatchObject({ code, status });
});

test("an error response without a contract envelope maps to INTERNAL_ERROR with its status", async () => {
  const fetch = () => new Response("<html>Bad gateway</html>", { status: 502 });
  const service = createFoodService({ baseUrl: BASE_URL, fetch });

  const call = service.getFoodPins();

  await expect(call).rejects.toBeInstanceOf(FoodApiError);
  await expect(call).rejects.toMatchObject({ code: "INTERNAL_ERROR", status: 502 });
});

test("a network failure maps to the client-only UPSTREAM_UNAVAILABLE with status 0", async () => {
  const fetch = () => Promise.reject(new TypeError("network"));
  const service = createFoodService({ baseUrl: BASE_URL, fetch });

  const call = service.getFoodPins();

  await expect(call).rejects.toBeInstanceOf(FoodApiError);
  await expect(call).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE", status: 0 });
});

test.each<[string, FoodCategory[]]>([
  ["an unknown category", ["cafe", "pizza" as never]],
  ["an empty list", []],
])("getFoodPins rejects %s without sending a request", async (_label, categories) => {
  const fetch = vi.fn(t.app.fetch);
  const service = createFoodService({ baseUrl: BASE_URL, fetch });

  const call = service.getFoodPins({ categories });

  await expect(call).rejects.toBeInstanceOf(FoodApiError);
  await expect(call).rejects.toMatchObject({ code: "INVALID_CATEGORY" });
  expect(fetch).not.toHaveBeenCalled();
});

test.each([
  ["categories", { districtId: DHAKA, categories: ["cafe" as const] }, ["Anna Sweets"]],
  [
    "several categories",
    { districtId: DHAKA, categories: ["cafe" as const, "restaurant" as const] },
    ["Anna Sweets", "Zinda Kebab"],
  ],
  ["hasVideo", { districtId: DHAKA, hasVideo: true }, []],
  // Without a bbox this query is the featured scope, which is empty here.
  ["bbox", { bbox: "90.3,23.7,90.5,23.9" }, ["Anna Sweets", "Zinda Kebab"]],
])("getFoodPins filters by %s", async (_label, filter, names) => {
  const service = createFoodService({ baseUrl: BASE_URL, fetch: t.app.fetch });

  const pins = await service.getFoodPins(filter);

  expect(pins.features.map((f) => f.properties.name_en).sort()).toEqual(names);
});

test("getFoodPinDetail returns the contract detail the API serves", async () => {
  const service = createFoodService({ baseUrl: BASE_URL, fetch: t.app.fetch });

  const detail = await service.getFoodPinDetail(zinda);

  const res = await t.app.request(`/api/v1/pins/food/${zinda}`);
  expect(detail).toEqual(FoodPinDetailSchema.parse(await res.json()));
  expect(detail.name_en).toBe("Zinda Kebab");
});

test("getFoodPinDetail rejects a 200 body that breaks the contract", async () => {
  const fetch = tampered((body) => ({ ...body, district_id: "Dhaka" }));
  const service = createFoodService({ baseUrl: BASE_URL, fetch });

  await expect(service.getFoodPinDetail(zinda)).rejects.toMatchObject({ name: "ZodError" });
});
