import { Command } from "commander"

export const authCmd = new Command("auth")
  .description("authenticate with GitHub OAuth")
  .action(() => {
    console.log("TODO: auth")
  })
