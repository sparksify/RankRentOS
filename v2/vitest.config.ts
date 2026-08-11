import { defineConfig } from "vitest/config";
// tests/convex/** are Convex-coupled REFERENCE tests, preserved but excluded
// until store-contract parity ports replace them (see V2_SUPABASE_RECONCILIATION.md §9)
export default defineConfig({
  test: { environment: "node", exclude: ["tests/convex/**", "node_modules/**"] },
});
