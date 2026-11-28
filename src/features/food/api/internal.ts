// The internal listener (Guide §8 Slice 2.13). The Directus Flow calls it after an editor's write.
// It has its own port, bound to the internal network only, and shares nothing with the public routes.
// A Flow cannot compute an HMAC, so the caller proves itself with a bearer token.
import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { parseJson } from "./json";
import type { Logger } from "./logger";
import type { ValkeyCache } from "./valkey";

interface InternalDeps {
  cache: Pick<ValkeyCache, "bumpEpoch">;
  logger: Logger;
}

// The Flow sends its whole trigger. A create names one `key`, an update or delete a list of `keys`.
const ItemKey = z.union([z.string(), z.number()]);
const TriggerSchema = z.object({
  event: z.string(),
  collection: z.string(),
  key: ItemKey.optional(),
  keys: z.array(ItemKey).optional(),
});

// Digests have one length, so the comparison takes the same time whatever was sent.
const digest = (text: string) => createHash("sha256").update(text).digest();

function createInternalApp(token: string, deps: InternalDeps) {
  const expected = digest(`Bearer ${token}`);

  return new Hono().post("/internal/v1/cache/invalidate", async (c) => {
    if (!timingSafeEqual(digest(c.req.header("authorization") ?? ""), expected)) {
      deps.logger.warn({}, "invalidate refused: wrong or missing bearer token");
      return c.body(null, 401);
    }
    await deps.cache.bumpEpoch("directus flow");

    // The body only describes the change, so an unreadable one still invalidates.
    const trigger = parseJson(await c.req.text(), TriggerSchema);
    if (trigger.ok) {
      const { event, collection, key, keys } = trigger.value;
      deps.logger.info({ event, collection, keys: keys ?? (key === undefined ? [] : [key]) }, "cache invalidated");
    } else {
      deps.logger.warn({ err: trigger.error }, "cache invalidated, but the trigger was unreadable");
    }
    return c.body(null, 204);
  });
}

export function startInternalListener(
  config: { bindAddr: string; port: number; invalidateToken: string },
  deps: InternalDeps,
) {
  const app = createInternalApp(config.invalidateToken, deps);
  return Bun.serve({ hostname: config.bindAddr, port: config.port, fetch: app.fetch });
}
