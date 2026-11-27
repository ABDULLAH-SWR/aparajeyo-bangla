// A complete, valid API environment. Values are visibly fake.
import { fileURLToPath } from "node:url";

export const GEO_CODES_FILE = fileURLToPath(new URL("../../../data/geo_codes.v03.json", import.meta.url));

export function validEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://food_api@127.0.0.1:1/nowhere",
    VALKEY_URL: "redis://127.0.0.1:1/0",
    IMGPROXY_BASE_URL: "https://img.example.test",
    IMGPROXY_KEY: "01".repeat(32),
    IMGPROXY_SALT: "02".repeat(32),
    CORS_ALLOWED_ORIGINS: "https://map.example.test",
    FOOD_INTERNAL_BIND_ADDR: "127.0.0.1",
    FOOD_INVALIDATE_TOKEN: "x".repeat(32),
    GEO_CODES_PATH: GEO_CODES_FILE,
    ...overrides,
  };
}

export function without(env: Record<string, string>, name: string): Record<string, string> {
  const copy = { ...env };
  delete copy[name];
  return copy;
}
