// On by default. DISTRO_NO_AUTOUPDATE=1 (env) or cli.autoUpdate=false (config.json,
// CLI-local — not the synced server preferences) disables it.
export function autoUpdateEnabled(cliConfig: { autoUpdate?: boolean }): boolean {
  if (process.env["DISTRO_NO_AUTOUPDATE"] === "1") return false
  return cliConfig.autoUpdate !== false
}
