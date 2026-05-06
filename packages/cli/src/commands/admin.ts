import { Command } from "commander"
import { advertiserCmd } from "./admin/advertiser.js"
import { campaignCmd } from "./admin/campaign.js"
import { creativeCmd } from "./admin/creative.js"
import { statsCmd } from "./admin/stats.js"
import { inviteCmd } from "./admin/invite.js"
import { userCmd } from "./admin/user.js"
import { payoutCmd } from "./admin/payout.js"

export const adminCmd: Command = new Command("admin")
  .description("admin subcommands (requires DISTRO_ADMIN_SECRET)")
  .addCommand(advertiserCmd)
  .addCommand(campaignCmd)
  .addCommand(creativeCmd)
  .addCommand(statsCmd)
  .addCommand(inviteCmd)
  .addCommand(userCmd)
  .addCommand(payoutCmd)
