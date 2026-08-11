import { defineConfig } from "vitest/config";
// reference/** = Convex reference implementation, preserved but never built/run
export default defineConfig({
  test: { environment: "node", exclude: ["**/reference/**", "**/node_modules/**"] },
});
