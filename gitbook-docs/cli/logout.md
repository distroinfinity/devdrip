# distro logout

`distro logout` signs you out of Distro TV and removes the local CLI config.

## What it does

1. Calls `POST /auth/logout` with the current device bearer (best-effort — succeeds offline too).
2. Deletes `~/.distro/config.json`.

Hooks installed in `~/.claude/settings.json` are left in place. They become no-ops once the config is gone (the daemon socket reports unauthed and the hooks exit 0).

## When to use it

- Switching GitHub accounts on the same machine.
- Decommissioning a device.
- Troubleshooting a stuck session.

After logout, run `distro init` to sign back in.
