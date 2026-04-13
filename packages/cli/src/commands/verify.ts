import { Command } from "commander"

export const verifyCmd = new Command("verify")
  .description("privacy and data verification")
  .option("--privacy", "show what data is transmitted to backend")
  .action(() => {
    console.log("TODO: verify")
  })
