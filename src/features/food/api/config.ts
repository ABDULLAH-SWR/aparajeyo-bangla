// Environment validation (Guide Appendix E). Errors name variables, never their values.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";

export class ConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConfigError";
  }
}

const GeoCodesSchema = z.object({
  districts: z.array(z.object({ id: z.string().regex(/^BD\d{4}$/) })).length(64),
});

// Whatever GEO_CODES_PATH points at must match the checksum committed beside the vendored file.
const GEO_CODES_CHECKSUM = new URL("../data/geo_codes.v03.json.sha256", import.meta.url);

/** The 64 ADM2 P-codes from the vendored geo codes file. Read once, at boot. */
export function loadDistrictIds(path: string): ReadonlySet<string> {
  try {
    const bytes = readFileSync(path);
    const expected = readFileSync(GEO_CODES_CHECKSUM, "utf8").trim().split(/\s+/)[0];
    if (createHash("sha256").update(bytes).digest("hex") !== expected) {
      throw new Error("sha256 differs from data/geo_codes.v03.json.sha256");
    }
    const { districts } = GeoCodesSchema.parse(JSON.parse(bytes.toString("utf8")));
    return new Set(districts.map((d) => d.id));
  } catch (cause) {
    throw new ConfigError(`invalid configuration\n  GEO_CODES_PATH: ${(cause as Error).message}`, { cause });
  }
}

const splitOrigins = (list: string) => list.split(",").map((origin) => origin.trim()).filter(Boolean);
const Hex32 = z.string().regex(/^[0-9a-f]{64,}$/i, "must be at least 32 bytes of hex");

// Only zeros, colons, dots and brackets (or nothing) spells "every interface" in some notation.
const BindAddr = z.string().refine((a) => !/^[0:.[\]\s]*$/.test(a), "internal listener must not bind all interfaces");

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.coerce.number().int().default(8002),
    DATABASE_URL: z.url(),
    VALKEY_URL: z.url(),
    IMGPROXY_BASE_URL: z.url(),
    IMGPROXY_KEY: Hex32,
    IMGPROXY_SALT: Hex32,
    // The workers and imgproxy default to this bucket until the Phase 2 media pipeline renames it.
    S3_BUCKET: z.string().min(1).default("aparajeyo"),
    CORS_ALLOWED_ORIGINS: z.string().min(1),
    FOOD_INTERNAL_BIND_ADDR: BindAddr,
    FOOD_INTERNAL_PORT: z.coerce.number().int().default(8003),
    FOOD_INVALIDATE_TOKEN: z.string().min(32),
    GEO_CODES_PATH: z.string().min(1),
  })
  .superRefine((c, ctx) => {
    if (c.NODE_ENV === "production" && splitOrigins(c.CORS_ALLOWED_ORIGINS).includes("*")) {
      ctx.addIssue({ code: "custom", path: ["CORS_ALLOWED_ORIGINS"], message: "wildcard origin not allowed in production" });
    }
  });

export function loadConfig(env: Record<string, string | undefined>) {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new ConfigError(`invalid configuration\n  ${problems.join("\n  ")}`);
  }
  const c = parsed.data;
  return {
    nodeEnv: c.NODE_ENV,
    port: c.PORT,
    databaseUrl: c.DATABASE_URL,
    valkeyUrl: c.VALKEY_URL,
    imgproxy: {
      baseUrl: c.IMGPROXY_BASE_URL,
      keyHex: c.IMGPROXY_KEY,
      saltHex: c.IMGPROXY_SALT,
      bucket: c.S3_BUCKET,
    },
    corsAllowedOrigins: splitOrigins(c.CORS_ALLOWED_ORIGINS),
    internal: {
      bindAddr: c.FOOD_INTERNAL_BIND_ADDR,
      port: c.FOOD_INTERNAL_PORT,
      invalidateToken: c.FOOD_INVALIDATE_TOKEN,
    },
    districtIds: loadDistrictIds(c.GEO_CODES_PATH),
  };
}

export type Config = ReturnType<typeof loadConfig>;
