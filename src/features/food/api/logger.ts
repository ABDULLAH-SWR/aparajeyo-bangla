/** Pino-style call shape: structured context first, message second. */
export interface Logger {
  info(context: Record<string, unknown>, message: string): void;
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
}

export const consoleLogger: Logger = {
  info: (context, message) => console.log(`[food-api] ${message}`, context),
  warn: (context, message) => console.warn(`[food-api] ${message}`, context),
  error: (context, message) => console.error(`[food-api] ${message}`, context),
};
