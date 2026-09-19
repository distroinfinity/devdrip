import { Command } from "commander"

// placeholder hook handlers — they silently exit 0 to stay out of Claude Code's way
// until S2-11 wires the real IPC to the daemon. CLAUDE.md rule: hooks always exit 0.
const preTool = new Command("pre-tool").description("handle PreToolUse hook").action(() => {
  // TODO(S2-11): send idle-start to daemon over socket
})

const stop = new Command("stop").description("handle Stop hook").action(() => {
  // TODO(S2-11): send idle-end to daemon over socket
})

const promptSubmit = new Command("prompt-submit")
  .description("handle UserPromptSubmit hook")
  .action(() => {
    // TODO(S2-11): send dismiss to daemon over socket
  })

export const hookCmd = new Command("hook")
  .description("internal hook handlers for Claude Code")
  .addCommand(preTool)
  .addCommand(stop)
  .addCommand(promptSubmit)
