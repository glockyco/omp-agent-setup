# Proposal

## Why

The notes skill tells agents that Notes sections keep "history", and Notes sections grew into logs the way the `Resume here:` lines had. The Bloodline note's Notes ran to 3,018 words of recon, spike and lab findings by date, and three entries revised earlier ones in new entries instead of editing them. The vault's `Conventions.md` now says that an item's Notes hold its decisions and constraints as they hold now, one entry per subject, and that the vault's Git history and daily notes keep what happened. The skill still points the other way.

## What Changes

- The notes skill's first Write line says that notes keep dates and who decided what, as `Conventions.md` describes for Notes, and no longer that Notes sections keep history.
- Release the change as 0.11.6.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: the notes skill defers to `Conventions.md` for what Notes hold.

## Impact

Sessions on upgraded hosts edit a Notes entry when a decision changes instead of adding a dated one. A session that started before the upgrade keeps the previous skill until it restarts.
