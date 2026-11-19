import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Üretilen çıktılar: kaynak değil, lint kapsamı dışında.
    ".open-next/**",
    ".wrangler/**",
    "freebuff-sites-build/**",
    "release/**",
    "coverage/**",
    "freebuff.open-next.config.ts",
  ]),
]);
