import { Command } from "commander"

// TODO: after successful token exchange, call registerDevice(token, apiBaseUrl)
// from ../lib/device.ts to register this machine and persist the returned device.id

export const authCmd = new Command("auth")
  .description("authenticate with GitHub OAuth")
  .action(() => {
    console.log("TODO: auth")
  })
