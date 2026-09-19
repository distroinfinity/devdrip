import { Command } from "commander"

export const upgradeCmd = new Command("upgrade")
  .description("check npm registry for updates")
  .action(() => {
    console.log("TODO: upgrade")
  })
