/** Pino-style call shape: structured context first, message second. */
export interface Logger {
  warn(context: Record<string, unknown>, message: string): void;
  error(context: Record<string, unknown>, message: string): void;
}

export const consoleLogger: Logger = {
  warn: (context, message) => console.warn(`[food-api] ${message}`, context),
  error: (context, message) => console.error(`[food-api] ${message}`, context),
};
