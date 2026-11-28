/// <reference types="bun" />
// Slice 2.8: the real imgproxy rejects tampering, foreign sources and oversize inputs.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createImgproxySigner } from "../../imgproxy";
import { startMediaStack, type MediaStack } from "../support/media";

const JPEG = readFileSync(fileURLToPath(new URL("../../../testdata/media/kacchi.jpg", import.meta.url)));
const KEY = "photos/food/6f1d2c3a-8b4e-4f5a-9c7d-1e2f3a4b5c6d/kacchi.jpg";
const OTHER_BUCKET = "other-bucket";

let stack: MediaStack;

async function upload(bucket: string, key: string, body: Uint8Array): Promise<void> {
  const s3 = new Bun.S3Client({
    endpoint: stack.S3_ENDPOINT,
    region: stack.S3_REGION,
    bucket,
    accessKeyId: stack.S3_ACCESS_KEY,
    secretAccessKey: stack.S3_SECRET_KEY,
  });
  await s3.write(key, body, { type: "image/jpeg" });
}

const signedUrl = (key: string, bucket = stack.S3_BUCKET) =>
  createImgproxySigner({
    baseUrl: stack.IMGPROXY_BASE_URL,
    keyHex: stack.IMGPROXY_KEY,
    saltHex: stack.IMGPROXY_SALT,
    bucket,
  }).sign(key, 320);

beforeAll(async () => {
  stack = await startMediaStack();
  await upload(stack.S3_BUCKET, KEY, JPEG);
  // Readable with imgproxy's own key, so only its source allowlist stands in the way.
  await stack.garage("bucket", "create", OTHER_BUCKET);
  await stack.garage("bucket", "allow", "--read", "--write", OTHER_BUCKET, "--key", "food-worker");
  await stack.garage("bucket", "allow", "--read", OTHER_BUCKET, "--key", "food-imgproxy");
  await upload(OTHER_BUCKET, "x.jpg", JPEG);
}, 300_000);

afterAll(() => stack?.down(), 120_000);

describe("imgproxy", () => {
  test("c1 serves a validly signed thumbnail", async () => {
    const response = await fetch(signedUrl(KEY));

    expect(response.status).toBe(200);
  });

  test("c2 refuses a URL with one signature character changed", async () => {
    const url = new URL(signedUrl(KEY));
    const [, signature, ...path] = url.pathname.split("/");
    const flipped = `${signature!.startsWith("A") ? "B" : "A"}${signature!.slice(1)}`;
    url.pathname = ["", flipped, ...path].join("/");

    const response = await fetch(url);

    expect(response.status).toBe(403);
  });

  test("c3 refuses a correctly signed URL for another bucket", async () => {
    const response = await fetch(signedUrl("x.jpg", OTHER_BUCKET));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  test("c4 answers a browser that accepts AVIF with AVIF", async () => {
    const response = await fetch(signedUrl(KEY), { headers: { Accept: "image/avif" } });

    expect(response.headers.get("Content-Type")).toBe("image/avif");
  });

  test("c5 publishes imgproxy and Garage on loopback only, from a pinned imgproxy", async () => {
    const { services } = await stack.composeConfig();
    const published = [...(services.imgproxy?.ports ?? []), ...(services.garage?.ports ?? [])];

    expect(published.map((port) => [port.target, port.host_ip]).sort()).toEqual([
      [3900, "127.0.0.1"],
      [3903, "127.0.0.1"],
      [8080, "127.0.0.1"],
    ]);
    expect(services.imgproxy?.image).toMatch(/^darthsim\/imgproxy:v4\.\d+\.\d+@sha256:[0-9a-f]{64}$/);
  });

  test("c6 refuses a source file over 10 MiB", async () => {
    const oversize = new Uint8Array(11 * 1024 * 1024);
    oversize.set(JPEG); // still a decodable JPEG, followed by padding
    await upload(stack.S3_BUCKET, "photos/food/oversize.jpg", oversize);

    const response = await fetch(signedUrl("photos/food/oversize.jpg"));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  }, 60_000);
});
