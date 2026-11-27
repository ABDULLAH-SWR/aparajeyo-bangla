// Config seam: how the client resolves the Food API base URL.
import { afterEach, expect, test, vi } from "vitest";
import { getFoodApiBaseUrl } from "../../../constants";

afterEach(() => {
  vi.unstubAllEnvs();
});

test.each([
  ["unset", undefined],
  ["blank", "  "],
])("%s base URL in production throws on first use, not at module load", async (_label, value) => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_FOOD_API_BASE_URL", value);
  // Only the NEXT_PUBLIC_ name reaches the browser bundle, so this one must not stand in for it.
  vi.stubEnv("FOOD_API_BASE_URL", "https://server-only.example.test");
  vi.resetModules();

  const constants = await import("../../../constants");

  expect(() => constants.getFoodApiBaseUrl()).toThrow("NEXT_PUBLIC_FOOD_API_BASE_URL");
});

test.each(["https://x/", "https://x//", " https://x "])("normalizes %j to https://x", (configured) => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_FOOD_API_BASE_URL", configured);

  expect(getFoodApiBaseUrl()).toBe("https://x");
});

test("outside production an unset base URL means the local API", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_FOOD_API_BASE_URL", undefined);
  vi.stubEnv("FOOD_API_BASE_URL", undefined);

  expect(getFoodApiBaseUrl()).toBe("http://localhost:8002");
});
