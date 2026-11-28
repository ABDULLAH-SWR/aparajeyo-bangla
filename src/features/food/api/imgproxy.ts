import crypto from "node:crypto";

const SIGNABLE_WIDTHS: ReadonlySet<number> = new Set([320, 1280]);

export class UnsupportedWidthError extends Error {
  constructor(width: number) {
    super(`imgproxy width ${width} is not signable; use one of ${[...SIGNABLE_WIDTHS].join(", ")}`);
    this.name = "UnsupportedWidthError";
  }
}

interface ImgproxyConfig {
  baseUrl: string;
  /** Hex-encoded. */
  keyHex: string;
  /** Hex-encoded. */
  saltHex: string;
  bucket: string;
}

export interface ImgproxySigner {
  sign(s3Key: string, width: number): string;
}

/** HMAC-SHA256 signed imgproxy v4 URLs backed by Garage S3 (Guide Appendix D.1, Rule R4). */
export function createImgproxySigner(config: ImgproxyConfig): ImgproxySigner {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const key = Buffer.from(config.keyHex, "hex");
  const salt = Buffer.from(config.saltHex, "hex");
  const { bucket } = config;

  return {
    sign(s3Key, width) {
      if (!SIGNABLE_WIDTHS.has(width)) throw new UnsupportedWidthError(width);
      const processingPath = `/rs:fit:${width}:0/plain/s3://${bucket}/${s3Key}`;
      const signature = crypto.createHmac("sha256", key).update(salt).update(processingPath).digest("base64url");
      return `${baseUrl}/${signature}${processingPath}`;
    },
  };
}
