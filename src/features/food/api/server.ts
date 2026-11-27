// Run from the feature root (`bun run dev`) so that Bun loads .env and .env.local.
// The local Docker stack is started separately: `bun run dev:up`.
import { buildDeps, createFoodApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig(process.env);

export default { port: config.port, fetch: createFoodApp(buildDeps(config)).fetch };
