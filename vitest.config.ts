import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Fix: PRO-16 — mock server-only so tests can import server modules
      "server-only": path.resolve(__dirname, "src/lib/__mocks__/server-only.ts"),
    },
  },
});
