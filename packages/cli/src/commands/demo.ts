import { Command } from "commander"

export const demoCmd = new Command("demo").description("fire a demo ad immediately").action(() => {
  console.log("TODO: demo")
})
