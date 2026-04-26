# @devdrip/cli

Earn or learn while your AI agent codes. Opt-in USDC micropayments and tech-news slots during Claude Code idle time, settled on World Chain.

## Install

```bash
npm i -g @devdrip/cli && devdrip init
```

`devdrip init` walks you through:

1. GitHub OAuth (also pairs to a World ID wallet via the World App)
2. Channel mode — `earn` (ads only), `learn` (news only), or `both`
3. Ad/topic preferences
4. Hooking into your `~/.claude/settings.json` so the daemon shows slots while Claude Code is thinking

## Requirements

- Node.js 20+
- macOS or Linux
- [Claude Code](https://claude.com/claude-code) installed

## Common commands

```bash
devdrip status          # current earnings, streak, next payout
devdrip preferences     # change channel mode / categories / topics
devdrip auth            # re-authenticate
devdrip daemon stop     # stop the background daemon
devdrip uninstall       # remove hooks and config
```

## How payouts work

- Every confirmed impression credits your local SQLite ledger (ground truth, no network required).
- The backend reconciles your balance and pays out USDC on World Chain Sepolia every Sunday once your balance is at least $5.
- Claim manually via the dashboard at any time over $0.50.

## Links

- Landing: <https://devdrip.xyz>
- Source: <https://github.com/distroinfinity/devdrip>
- Issues: <https://github.com/distroinfinity/devdrip/issues>

## License

MIT
