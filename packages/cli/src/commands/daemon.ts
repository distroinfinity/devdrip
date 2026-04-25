import { Command } from "commander"

const start = new Command("start").description("start the background daemon").action(() => {
  console.log("TODO: start daemon")
})

const stop = new Command("stop").description("stop the background daemon").action(() => {
  console.log("TODO: stop daemon")
})

const status = new Command("status").description("show daemon status").action(() => {
  console.log("TODO: daemon status")
})

export const daemonCmd = new Command("daemon")
  .description("manage the background daemon process")
  .addCommand(start)
  .addCommand(stop)
  .addCommand(status)
