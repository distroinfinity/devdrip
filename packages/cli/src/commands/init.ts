import { Command } from "commander"

export const initCmd = new Command("init").description("guided onboarding wizard").action(() => {
  console.log("TODO: init")
})
