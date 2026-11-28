/// <reference types="bun" />
// Slice 2.13: an editor's change reaches the API through the Directus Flow and the internal listener.
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, inject, test } from "vitest";
import { systemClock } from "../../clock";
import { startInternalListener } from "../../internal";
import type { Logger } from "../../logger";
import { createMetrics } from "../../metrics";
import { createValkeyCache } from "../../valkey";
import { adminClient, createEditor, eventually, ownerDb, type DirectusClient } from "../support/directus-api";
import { directusStack } from "../support/directus-stack";
import { insertPlace } from "../support/fixtures";

let owner: postgres.Sql;
let editor: DirectusClient;

beforeAll(async () => {
  owner = ownerDb();
  ({ client: editor } = await createEditor(await adminClient()));
});

afterAll(() => owner?.end());

const detailStatus = async (id: string) =>
  (await fetch(`${inject("directus").FOOD_API_URL}/api/v1/pins/food/${id}`)).status;

describe("an editor's change", () => {
  test("c1 hides a place from the API within 60 s", async () => {
    const id = await insertPlace(owner);
    expect(await detailStatus(id)).toBe(200); // now cached

    expect((await editor.patch(`/items/places/${id}`, { is_hidden: true })).status).toBe(200);
    const { value: status } = await eventually(() => detailStatus(id), (s) => s === 404);

    expect(status).toBe(404);
    // The Flow's own request body reached the listener and was understood.
    const logs = await directusStack(inject("directusProject")).run("logs", "food-api");
    expect(logs).toContain("cache invalidated");
    expect(logs).toContain(id);
    expect(logs).not.toContain("trigger was unreadable");
  });

  // §8.3 exit gate: p100 over 10 trials.
  test("is visible within 60 s in each of 10 trials", { timeout: 660_000 }, async () => {
    const id = await insertPlace(owner);
    const times: number[] = [];
    for (let trial = 0; trial < 10; trial++) {
      const hidden = trial % 2 === 0;
      const expected = hidden ? 404 : 200;
      expect((await editor.patch(`/items/places/${id}`, { is_hidden: hidden })).status).toBe(200);
      const { value, elapsedMs } = await eventually(() => detailStatus(id), (status) => status === expected);
      expect(value, `trial ${trial + 1}`).toBe(expected);
      times.push(elapsedMs);
    }
    console.info(`editor change visible after (ms): ${times.join(", ")}; max ${Math.max(...times)}`);
  });
});

describe("the internal listener", () => {
  const TOKEN = "listener-test-token-".padEnd(40, "x");
  const logged: Record<string, unknown>[] = [];
  const logger: Logger = { info: (context) => void logged.push(context), warn: () => {}, error: () => {} };
  let cache: ReturnType<typeof createValkeyCache>;
  let listener: ReturnType<typeof startInternalListener>;

  beforeAll(() => {
    // A logical database of its own: the running stack's Flow bumps the epoch in DB 0.
    const url = new URL(inject("directus").VALKEY_URL);
    url.pathname = "/15";
    cache = createValkeyCache(url.toString(), { logger, metrics: createMetrics(), clock: systemClock });
    listener = startInternalListener({ bindAddr: "127.0.0.1", port: 0, invalidateToken: TOKEN }, { cache, logger });
  });

  afterAll(async () => {
    await listener?.stop(true);
    cache?.close();
  });

  const invalidate = (authorization?: string) =>
    fetch(`http://127.0.0.1:${listener.port}/internal/v1/cache/invalidate`, {
      method: "POST",
      headers: authorization === undefined ? {} : { Authorization: authorization },
      body: JSON.stringify({ event: "items.update", collection: "places", keys: ["a-place"] }),
    });

  test.each([undefined, "Bearer wrong", `Bearer ${TOKEN}x`, TOKEN])(
    "c2 refuses the authorization %j and leaves the epoch alone",
    async (authorization) => {
      const before = await cache.readEpoch();

      const response = await invalidate(authorization);

      expect(response.status).toBe(401);
      expect(await cache.readEpoch()).toBe(before);
    },
  );

  test("bumps the epoch for the right token, and logs what changed", async () => {
    const before = (await cache.readEpoch())!;

    const response = await invalidate(`Bearer ${TOKEN}`);

    expect(response.status).toBe(204);
    expect(await cache.readEpoch()).toBe(before + 1);
    expect(logged).toContainEqual({ event: "items.update", collection: "places", keys: ["a-place"] });
  });
});

describe("the compose file", () => {
  const composeConfig = () => directusStack(inject("directusProject")).composeConfig();

  test("c3 publishes no host port for the internal listener", async () => {
    const config = await composeConfig();
    const published = Object.values(config.services).flatMap((service) => service.ports ?? []);

    // loadConfig's refusal of 0.0.0.0 and :: is covered by tests/config.test.ts (c6).
    expect(published.length).toBeGreaterThan(0);
    expect(published.filter((port) => port.target === 8003)).toEqual([]);
  });

  // §8.3 review item: the API only signs URLs.
  test("gives the API no S3 credentials", async () => {
    const names = Object.keys((await composeConfig()).services["food-api"]?.environment ?? {});

    expect(names).toContain("S3_BUCKET"); // the environment was read
    expect(names.filter((name) => /^(AWS_|S3_IMGPROXY_|S3_ACCESS_KEY$|S3_SECRET_KEY$)/.test(name))).toEqual([]);
  });
});
