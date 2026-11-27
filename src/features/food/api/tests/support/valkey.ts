// One logical database per cache test file. DB 0 holds dev Food keys and DB 1 holds Directus.
import Redis from "ioredis";
import { inject } from "vitest";

export async function createFileValkey(index: 11 | 12 | 13 | 14 | 15) {
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
