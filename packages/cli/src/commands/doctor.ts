import { Command } from "commander"

export const doctorCmd = new Command("doctor").description("run health check suite").action(() => {
  console.log("TODO: doctor")
})
