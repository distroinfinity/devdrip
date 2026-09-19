# Glossary

## Ad Category

Domain grouping for an ad, such as developer tools, databases, or monitoring.

## Ad Source

Origin of a creative, such as `direct`, `carbon`, `google`, or `x402`.

## Ad Surface

Where an ad experience can appear. Shared enums already define values such as `terminal-tv`, `companion-tab`, and `idle-dashboard`.

## Campaign

A budgeted advertiser unit with targeting, pacing, schedule, and status.

## Creative

The actual ad payload linked to a campaign. Includes headline, body, CTA, source, surface, category, and rate data.

## Device Registration

Authenticated backend call that records a machine hash, OS, IDE type, and device name for a user.

## Earning

A ledger entry tied to an impression, storing the amount earned in USDC plus classification data.

## Impression

A recorded ad display event with duration, result, source, surface, and earned amount.

## IDE Type

Current shared classification for client context: `terminal`, `vscode`, or `cursor`.

## Idle State

A product concept modeled in `packages/shared` with values `active`, `warming`, and `idle`. The runtime state machine is not implemented yet in the CLI package.

## Local Ledger

The planned local store of impressions and earnings on the developer machine. It is part of the modeled architecture, but no CLI implementation exists yet.

## Payout

A USDC withdrawal record tied to a user and wallet address, with processing status and optional on-chain transaction hash.

## Refresh Token Family

A group of related refresh tokens used for rotation and reuse detection.

## Surface

Short form for ad surface. In code and docs, it describes the UI placement or channel where an ad is delivered.
