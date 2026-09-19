import { Command } from "commander"

export const syncCmd = new Command("sync")
  .description("sync local ledger impressions to backend")
  .action(() => {
    console.log("TODO: sync")
  })
