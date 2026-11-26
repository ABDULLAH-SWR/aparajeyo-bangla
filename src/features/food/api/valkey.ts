import Redis from "ioredis";

const DEFAULT_VALKEY_URL = "redis://127.0.0.1:6382/0";

function normalizeValkeyUrl(raw: string): string {
  return raw.replace(/^valkey:\/\//i, "redis://");
}

export const valkey = new Redis(
  normalizeValkeyUrl(process.env.VALKEY_URL ?? DEFAULT_VALKEY_URL),
  {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
  }
);

valkey.on("error", () => {
  // Handled gracefully per-request so Valkey hiccups fall back cleanly to PostGIS
});

/** Snaps a bbox to a z12 Web Mercator tile grid so neighboring viewports share Valkey entries (Guide §8). */
export function snapBboxToZ12Key(minLng: number, minLat: number, maxLng: number, maxLat: number): string {
  const n = 4096; // 2^12
  const lngToX = (lng: number) => Math.floor(((lng + 180) / 360) * n);
  const latToY = (lat: number) => {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  };
  return `${lngToX(minLng)},${latToY(maxLat)}-${lngToX(maxLng)},${latToY(minLat)}`;
}

export async function safeValkeyGet(key: string): Promise<string | null> {
  try {
    if (valkey.status === "wait") await valkey.connect();
    return await valkey.get(key);
  } catch {
    return null;
  }
}

export async function safeValkeySet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    if (valkey.status === "wait") await valkey.connect();
    await valkey.set(key, value, "EX", ttlSeconds);
  } catch {
    // Non-fatal cache write failure
  }
}
