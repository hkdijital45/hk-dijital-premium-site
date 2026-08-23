import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // API payloads and Supabase JSON columns are intentionally dynamic at system boundaries.
      // Runtime validation remains mandatory; forcing broad casts here adds noise without safety.
      "@typescript-eslint/no-explicit-any": "off",
      // Standard convention: a leading underscore marks a binding as
      // intentionally unused (e.g. a required-but-unused function parameter).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["electron/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Desktop app build output — desktop/build/macos/dmg-root contains a
    // real `ln -s /Applications` symlink for DMG staging; without this
    // excluded, a symlink-following tool can end up traversing the actual
    // system /Applications folder (confirmed: tripped up `tsc` this way).
    "desktop/build/**",
    "desktop-builds/**",
    "desktop/windows/publish/**",
  ]),
]);

export default eslintConfig;
