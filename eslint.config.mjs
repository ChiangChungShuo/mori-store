import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested git worktrees are separate checkouts of this repo; linting them
    // reports the same files twice and flags code that is not on this branch.
    // vitest.config.ts excludes them from the test run for the same reason.
    "**/.worktrees/**",
    "**/.claude/worktrees/**",
  ]),
]);

export default eslintConfig;
