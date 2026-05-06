import { Command } from "commander"

export const feedbackCmd = new Command("feedback")
  .description("send a one-line feedback note (coming in M7)")
  .argument("[message]", "feedback message")
  .action((message?: string) => {
    void message
    process.stdout.write("feedback ingest lands in M7 (admin dashboard)\n")
    process.exit(0)
  })
