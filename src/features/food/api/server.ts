// Run from the feature root (`bun run dev`) so that Bun loads .env and .env.local.
// The local Docker stack is started separately: `bun run dev:up`.
import { buildDeps, createFoodApp } from "./app";
import { loadConfig } from "./config";
import { startInternalListener } from "./internal";

const config = loadConfig(process.env);
const deps = buildDeps(config);

startInternalListener(config.internal, deps);

export default { port: config.port, fetch: createFoodApp(deps).fetch };
