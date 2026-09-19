# CLI Current State

`packages/cli` defines the command surface for the future DevDrip local experience, but most commands are still placeholders.

## Structure

- entrypoint: `src/index.ts`
- command parser: Commander
- package name: `@devdrip/cli`
- published binary: `devdrip`

## Registered Commands

- `init`
- `auth`
- `config`
- `status`
- `daemon`
- `sync`
- `claim`
- `demo`
- `doctor`
- `uninstall`
- `upgrade`
- `verify`
- `referral`
- `admin`
- `hook`

## Current Behavior

Most commands only print a `TODO` message.

That includes:

- `init`
- `auth`
- `config`
- `status`
- `daemon start`
- `daemon stop`
- `daemon status`
- `sync`
- `claim`
- `demo`
- `doctor`
- `uninstall`
- `upgrade`
- `verify`
- `referral`
- `hook pre-tool`
- `hook stop`
- `hook prompt-submit`

`admin` currently defines the command namespace and description only.

## The One Implemented Operational Piece

`src/lib/device.ts` contains actual device registration logic.

It does three useful things:

- computes a stable machine ID hash
- infers IDE type as `cursor`, `vscode`, or `terminal`
- POSTs to `/devices` on the backend and returns a shared `Device` payload

Machine ID source by platform:

- macOS: `IOPlatformUUID`
- Linux: `/etc/machine-id`
- Windows: registry `MachineGuid`

Fallback behavior:

- if a stable machine ID cannot be read, the code hashes hostname plus platform

## Current Intent Visible In Code

The `auth` command contains a note that, after successful token exchange, it should call `registerDevice()` and persist the returned device ID.

This tells us:

- CLI auth is expected to end in backend device registration
- the local device identity path is already partly defined

## What Is Missing For A Real CLI

- token storage
- settings or config persistence
- daemon process lifecycle
- hook handling
- local ledger
- ad cache
- renderer
- sync pipeline
- payout flow
- doctor checks

## Engineering Takeaway

Treat `packages/cli` as interface scaffolding plus one reusable device helper. If you are implementing local product behavior next, this package still needs core runtime work rather than cleanup work.
