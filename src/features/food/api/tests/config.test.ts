import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ConfigError, loadConfig } from "../config";
import { GEO_CODES_FILE, validEnv, without } from "./support/env";

describe("loadConfig", () => {
  test("accepts a complete environment and applies the documented defaults", () => {
    const config = loadConfig(validEnv({ CORS_ALLOWED_ORIGINS: "https://a.example.test, https://b.example.test" }));

    expect(config.port).toBe(8002);
    expect(config.internal.port).toBe(8003);
    expect(config.corsAllowedOrigins).toEqual(["https://a.example.test", "https://b.example.test"]);
    expect(config.districtIds.size).toBe(64);
  });

  test("c4 rejects a wildcard origin in production", () => {
    const env = validEnv({ NODE_ENV: "production", CORS_ALLOWED_ORIGINS: "https://a.example.test, *" });

    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  test.each(["development", "test", "production"])("c5 requires IMGPROXY_KEY in %s", (NODE_ENV) => {
    const env = without(validEnv({ NODE_ENV }), "IMGPROXY_KEY");

    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/IMGPROXY_KEY/);
  });

  test.each(["0.0.0.0", "::", "0:0:0:0:0:0:0:0", "[::]", ""])(
    'c6 refuses to bind the internal listener to every interface ("%s")',
    (FOOD_INTERNAL_BIND_ADDR) => {
      const env = validEnv({ FOOD_INTERNAL_BIND_ADDR });

      expect(() => loadConfig(env)).toThrow(ConfigError);
      expect(() => loadConfig(env)).toThrow(/FOOD_INTERNAL_BIND_ADDR/);
    },
  );

  test("rejects a geo codes file that differs from the committed checksum", () => {
    const dir = mkdtempSync(join(tmpdir(), "food-geo-"));
    const altered = join(dir, "geo_codes.v03.json");
    writeFileSync(altered, `${readFileSync(GEO_CODES_FILE, "utf8")}\n`);

    expect(() => loadConfig(validEnv({ GEO_CODES_PATH: altered }))).toThrow(ConfigError);
    rmSync(dir, { recursive: true, force: true });
  });

  test("never repeats a rejected secret in the error", () => {
    const env = validEnv({ IMGPROXY_KEY: "not-hex-secret-value" });

    expect(() => loadConfig(env)).toThrow(/IMGPROXY_KEY/);
    expect(() => loadConfig(env)).not.toThrow(/not-hex-secret-value/);
  });
});
