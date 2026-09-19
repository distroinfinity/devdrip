import { Command } from "commander"

export const referralCmd = new Command("referral")
  .description("show referral code and stats")
  .action(() => {
    console.log("TODO: referral")
  })
