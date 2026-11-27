import { describe, expect, test } from "vitest";
import vectors from "../../../testdata/imgproxy_vectors.json";
import { createImgproxySigner, UnsupportedWidthError } from "../../imgproxy";

const signerFor = (v: (typeof vectors)[number]) =>
  createImgproxySigner({ baseUrl: v.base_url, keyHex: v.key_hex, saltHex: v.salt_hex, bucket: v.bucket });

describe("imgproxy signer", () => {
  test.each(vectors)("c1 matches the golden vector at width $width ($s3_key)", (v) => {
    expect(signerFor(v).sign(v.s3_key, v.width)).toBe(v.expected_url);
  });

  test("c2 refuses a width outside the whitelist", () => {
    const v = vectors[0]!;

    expect(() => signerFor(v).sign(v.s3_key, 640)).toThrow(UnsupportedWidthError);
  });
});
