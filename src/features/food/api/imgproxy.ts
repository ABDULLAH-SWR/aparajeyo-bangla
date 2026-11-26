import crypto from "node:crypto";

/**
 * Generates HMAC-SHA256 signed imgproxy v4 URLs backed by Garage S3 (Guide §5.8, Rule R4).
 * Returns null unless imgproxy + S3 credentials are explicitly configured/active.
 */
export function signImgproxyUrl(s3Key: string, width: number): string | null {
  const baseUrl = process.env.IMGPROXY_BASE_URL?.trim()?.replace(/\/+$/, "");
  const keyHex = process.env.IMGPROXY_KEY?.trim();
  const saltHex = process.env.IMGPROXY_SALT?.trim();
  const bucket = process.env.S3_BUCKET?.trim() || "aparajeyo";

  if (!baseUrl || !keyHex || !saltHex) return null;

  try {
    const key = Buffer.from(keyHex, "hex");
    const salt = Buffer.from(saltHex, "hex");
    const processingPath = `/rs:fit:${width}:0/plain/s3://${bucket}/${s3Key}`;
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(salt);
    hmac.update(processingPath);
    const sig = hmac.digest("base64url");
    return `${baseUrl}/${sig}${processingPath}`;
  } catch {
    return null;
  }
}

export function isImgproxyConfigured(): boolean {
  return Boolean(
    process.env.IMGPROXY_BASE_URL?.trim() &&
      process.env.IMGPROXY_KEY?.trim() &&
      process.env.IMGPROXY_SALT?.trim()
  );
}
