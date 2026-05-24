import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/worker.ts", "src/migrate.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  sourcemap: true,
  // ship the migration sql next to the compiled runner so the deploy can apply
  // migrations without the source tree present. rm first so a pre-existing
  // dist/migrations can't nest the copy (cp -R into an existing dir).
  onSuccess: "rm -rf dist/migrations && cp -R src/db/migrations dist/migrations",
})
