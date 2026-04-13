import { Command } from "commander"

export const adminCmd = new Command("admin")
  .description("admin subcommands (requires ADMIN_SECRET)")
  .action(() => {
    console.log("TODO: admin")
  })
