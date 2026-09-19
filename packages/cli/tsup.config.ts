import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  dts: true,
  clean: true,
  sourcemap: true,
  // Banner: shebang + createRequire shim. Bundled CJS deps (commander, etc.)
  // emit `require()` calls for Node built-ins like "events". ESM doesn't have
  // a global require, so we synthesize one from import.meta.url via
  // Node's createRequire — the documented tsup pattern for mixed CJS/ESM.
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire as __cr_for_cli } from "node:module";\nconst require = __cr_for_cli(import.meta.url);',
  },
  // Bundle all pure-JS deps into the output so the release tarball doesn't
  // need `npm install` to resolve them. Native modules (better-sqlite3) must
  // stay external — they ship per-platform prebuilds via npm and can't be
  // bundled. Install.sh runs `npm install --omit=dev` against a stripped
  // runtime package.json (built in the release workflow) for those.
  noExternal: ["@distrotv/shared", "@clack/prompts", "cli-table3", "commander", "qrcode-terminal"],
  external: ["better-sqlite3"],
})
