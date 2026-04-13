import { Command } from "commander"

export const uninstallCmd = new Command("uninstall")
  .description("clean removal of hooks, daemon, and data")
  .action(() => {
    console.log("TODO: uninstall")
  })
