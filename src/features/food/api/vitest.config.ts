import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // One worker per core exhausts memory on small machines. The isolation pair needs at least 2.
    maxWorkers: 4,
    projects: [
      {
        // No containers.
        test: {
          name: "unit",
          include: [
            "tests/contract/{mocks,gen_enums,mocks_to_seed}.test.ts",
            "tests/{config.test.ts,client/constants.test.ts}",
            "tests/media/imgproxy.test.ts",
          ],
        },
      },
      {
        test: {
          name: "integration",
          // tests/repo runs under `bun test` (see package.json).
          include: [
            "tests/boot.test.ts",
            "tests/{http,cache,harness}/**/*.test.ts",
            "tests/client/food_service.test.ts",
            "tests/contract/{enum_parity,parity_matrix,mock_roundtrip}.test.ts",
            // Starts its own Garage and imgproxy (scripts/test-media-stack.sh).
            "tests/media/imgproxy_verify.test.ts",
          ],
          globalSetup: ["tests/support/global-setup.ts"],
          setupFiles: ["tests/support/setup.ts"],
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
