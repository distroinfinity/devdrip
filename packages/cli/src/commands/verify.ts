import { Command } from "commander"

export const verifyCmd = new Command("verify")
  .description("privacy and data verification")
  .action(() => {
    console.log("TODO: verify")
  })
