import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "integration",
          // tests/repo runs under `bun test` (see package.json).
          include: ["tests/*.test.ts", "tests/{http,cache,media}/**/*.test.ts"],
          globalSetup: ["tests/support/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
      {
        test: {
          name: "types",
          include: [],
          typecheck: {
            enabled: true,
            only: true,
            include: ["tests/types/**/*.test-d.ts"],
            tsconfig: "./tsconfig.json",
          },
        },
      },
    ],
  },
});
