import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Escalate from warn → error so broken hook deps block CI
      "react-hooks/exhaustive-deps": "error",
      // Downgrade to warn — pre-existing `any` usage across API routes is
      // technical debt to fix incrementally, not a build-blocking issue
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
