// One logical database per test file that needs Valkey (stricter than the per-worker index of Guide
// §7.1). Taken elsewhere: DB 0 dev, 1 Directus runtime, 10 workers, 15 Directus tests.
import Redis from "ioredis";
import { inject } from "vitest";

export async function createFileValkey(index: 8 | 9 | 11 | 12 | 13 | 14) {
  const url = new URL(inject("valkeyUrl"));
  url.pathname = `/${index}`;
  const client = new Redis(url.toString());
  await client.flushdb();

  return {
    url: url.toString(),
    client,
    async drop(): Promise<void> {
      await client.flushdb();
      await client.quit();
    },
  };
}

export type FileValkey = Awaited<ReturnType<typeof createFileValkey>>;
