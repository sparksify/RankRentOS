import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // convex-test runs Convex functions in an in-memory environment that
    // matches the Convex runtime; edge-runtime is the supported harness.
    environmentMatchGlobs: [
      ["tests/convex/**", "edge-runtime"],
      ["**", "node"],
    ],
    server: { deps: { inline: ["convex-test"] } },
  },
});
