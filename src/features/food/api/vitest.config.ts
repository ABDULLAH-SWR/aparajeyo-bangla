import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "integration",
          include: ["tests/{http,cache,media}/**/*.test.ts"],
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
