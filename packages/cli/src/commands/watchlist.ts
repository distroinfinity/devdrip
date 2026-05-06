import { Command } from "commander"

export const watchlistCmd = new Command("watchlist").description("manage watchlists (coming in M4)")

for (const sub of ["add", "rm", "list", "switch"] as const) {
  watchlistCmd
    .command(sub)
    .description(`${sub} watchlist (coming in M4)`)
    .action(() => {
      process.stdout.write("watchlist commands land in M4 (ticker pipeline)\n")
      process.exit(0)
    })
}
