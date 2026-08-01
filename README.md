# OMP Agent Setup

Source of truth for my global [oh-my-pi](https://github.com/can1357/oh-my-pi) agent environment.
A Bun CLI deploys managed files, merges OMP config, reconciles active plugin forks, and reapplies local OMP source patches.

Personal clone-to-own dotfile, not a packaged tool — paths, plugin forks, and conventions are mine.

[![CI](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml/badge.svg)](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Requirements

- [Bun](https://bun.sh/) 1.3.14 (pinned in [`.bun-version`](./.bun-version))
- [oh-my-pi](https://github.com/can1357/oh-my-pi) on `PATH`
- `gh` for first-time plugin clone

## Quickstart

```bash
gh repo clone glockyco/omp-agent-setup ~/Projects/omp-agent-setup
cd ~/Projects/omp-agent-setup
bun install --frozen-lockfile
bun run bootstrap
bun run verify
```

## What bootstrap manages

| Source | Deployed at |
|---|---|
| `agent/AGENTS.md`, `agent/lsp.json`, `extensions/omp-session-env.ts`, `agent/skills/`, `agent/rules/`, `agent/agents/` | `~/.omp/agent/` — symlinked |
| `agent/optional-skills/` | `~/.omp/agent/optional-skills/` — symlinked, opt-in per repo via `omp-skill enable <name>` |
| managed keys in `src/config.ts` | `~/.omp/agent/config.yml` — merged |
| managed servers in `src/mcp.ts` | `~/.omp/agent/mcp.json` — merged |
| `manifests/plugins.yml` | active plugin checkouts under `~/Projects/` |
| `src/patches.ts` | OMP source files — patched in place by `update-omp` or `bootstrap` recovery |

Every run snapshots the pre-deploy state to `backups/<UTC-timestamp>/` before touching anything.
`bun run doctor` reports the current state without changing anything, including whether each managed MCP server's binary, background service, and daemon are actually healthy.

Bootstrap deliberately does not install background services. When a managed MCP server needs one, `doctor` prints the install command instead.

## MCP servers

| Server | Endpoint | Needs |
|---|---|---|
| `remnote` | `http://127.0.0.1:3001/mcp` | `remnote-mcp-server` on `PATH`, its launchd agent, and RemNote.app open for reads and writes |

Install the RemNote daemon's background service once with `remnote-mcp-server daemon install-launchd`; `remnote-mcp-server daemon uninstall-launchd` reverses it. Operating guidance for agents lives in [`agent/rules/remnote.md`](./agent/rules/remnote.md).

## Maintenance commands

| Script | What it does |
|---|---|
| `bun run bootstrap` | Deploy / reconcile all managed surfaces. Idempotent. |
| `bun run verify` | Full live gate for OMP smoke, skill discovery, logs, and `omp-plans`. |
| `bun run doctor` | Read-only health report. |
| `bun run audit-lsp` | Fleet LSP audit across `~/Projects/*`. `--include-dormant` widens the scan. |
| `bun run install-lsp` | Install all LSP binaries via the canonical channel. Idempotent. |
| `bun run update-omp` | Update OMP, then stop on the first failed bootstrap, doctor, or verify gate. |
| `bun run update-plannotator` | Rebase Plannotator fork's `omp-local` onto upstream; print the new SHA. |
| `bun run update-impeccable` | Vendor the latest Impeccable `.pi` skill into `agent/skills/impeccable` and the four Claude-variant subagents into `agent/agents/`; review diff before bootstrap. |

Use `bun run update-omp` for normal OMP updates. If the repository command cannot start, recover with `omp update`, then immediately run `bun run bootstrap`, `bun run doctor`, and `bun run verify`.

## Developer commands

| Script | What it does |
|---|---|
| `bun run ci` | Run lint, types, dead-code, dependency audit, and coverage tests. |
| `bun run fix` | Apply Biome fixes. |

## Plugins

| Plugin | Upstream | Fork (`omp-local`) |
|---|---|---|
| Plannotator | [backnotprop/plannotator](https://github.com/backnotprop/plannotator) | [glockyco/plannotator](https://github.com/glockyco/plannotator/tree/omp-local) |

`omp-local` carries minimal OMP-specific adapters on top of `upstream/main`. To update: `bun run update-plannotator` → push the fork branch after review → bump `currentCommit` in [`manifests/plugins.yml`](./manifests/plugins.yml) → `bun run verify`.

## LSP

Three layers: binaries on `$PATH` ([`scripts/install-lsp.sh`](./scripts/install-lsp.sh)) → global overrides ([`agent/lsp.json`](./agent/lsp.json)) → per-project `./lsp.json` only for genuine deviations. `bun run audit-lsp` surfaces gaps. See [`AGENTS.md`](./AGENTS.md#lsp-maintenance) for policy.

## License

[MIT](./LICENSE) — working on this repo? See [`AGENTS.md`](./AGENTS.md).
