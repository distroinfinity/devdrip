import { Command } from "commander"

export const statusCmd = new Command("status")
  .description("show daemon and session status")
  .action(() => {
    console.log("TODO: status")
  })
