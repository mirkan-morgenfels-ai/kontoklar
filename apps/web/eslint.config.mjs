import { dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const compat = new FlatCompat({
  baseDirectory,
  resolvePluginsRelativeTo: dirname(require.resolve("eslint-config-next/package.json")),
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"] },
];

export default config;
