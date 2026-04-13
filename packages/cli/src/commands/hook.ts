import { Command } from "commander"

const preTool = new Command("pre-tool").description("handle PreToolUse hook").action(() => {
  console.log("TODO: hook pre-tool")
})

const stop = new Command("stop").description("handle Stop hook").action(() => {
  console.log("TODO: hook stop")
})

const promptSubmit = new Command("prompt-submit")
  .description("handle UserPromptSubmit hook")
  .action(() => {
    console.log("TODO: hook prompt-submit")
  })

export const hookCmd = new Command("hook")
  .description("internal hook handlers for Claude Code")
  .addCommand(preTool)
  .addCommand(stop)
  .addCommand(promptSubmit)
