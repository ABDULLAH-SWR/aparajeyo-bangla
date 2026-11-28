/// <reference types="bun" />
// A real Garage and imgproxy: the services of docker-compose.yml, started under a throwaway project
// by scripts/test-media-stack.sh. Needs the Docker CLI with Compose (on Windows, inside WSL).
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { readComposeConfig, readSettings, runStackScript } from "./stack-script";

const SettingsSchema = z.object({
  IMGPROXY_BASE_URL: z.url(),
  IMGPROXY_KEY: z.string(),
  IMGPROXY_SALT: z.string(),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string(),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
});

export async function startMediaStack() {
  const project = `food-media-test-${randomBytes(5).toString("hex")}`;
  const script = runStackScript("test-media-stack.sh", project);
  const down = async () => void (await script("down"));
  try {
    const settings = SettingsSchema.parse(readSettings(await script("up")));
    return {
      ...settings,
      garage: (...args: string[]) => script("garage", ...args),
      composeConfig: () => readComposeConfig(script),
      down,
    };
  } catch (error) {
    await down();
    throw error;
  }
}

export type MediaStack = Awaited<ReturnType<typeof startMediaStack>>;
