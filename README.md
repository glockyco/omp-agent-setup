# OMP Agent Setup

Source-of-truth for a global [oh-my-pi](https://github.com/can1357/oh-my-pi) agent environment.
A Bun CLI deploys, merges, reconciles, and patches everything into place.

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
OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify
```

Drop `OMP_VERIFY_SKIP_ACCEPTANCE=1` once to run the full Superpowers acceptance smoke (slow, model-heavy, costs API calls).

## What bootstrap manages

| Source | Deployed at |
|---|---|
| `agent/AGENTS.md`, `agent/lsp.json`, `extensions/`, `agent/skills/` | `~/.omp/agent/` — symlinked |
| managed keys in `src/config.ts` | `~/.omp/agent/config.yml` — merged |
| managed keys in `src/zed-settings.ts` | `~/.config/zed/settings.json` — merged |
| `manifests/plugins.yml` | `~/Projects/{superpowers,plannotator}` — checkout at pinned `omp-local` commit |
| `src/patches.ts` | OMP source files — patched in place; re-run `bootstrap` after `omp update` |

Every run snapshots the pre-deploy state to `backups/<UTC-timestamp>/` before touching anything.
`bun run doctor` reports the current state without changing anything.

## Commands

| Script | What it does |
|---|---|
| `bun run bootstrap` | Deploy / reconcile all managed surfaces. Idempotent. |
| `bun run verify` | Full live gate. `OMP_VERIFY_SKIP_ACCEPTANCE=1` skips the model-heavy smoke. |
| `bun run doctor` | Read-only health report. |
| `bun run audit-lsp` | Fleet LSP audit across `~/Projects/*`. `--include-dormant` to widen. |
| `bun run install-lsp` | Install all LSP binaries via the canonical channel. Idempotent. |
| `bun run update-{superpowers,plannotator}` | Rebase fork's `omp-local` onto upstream; print new SHA. |
| `bun run ci` / `bun run fix` | All quality gates / Biome auto-fix. |

## Plugins

| Plugin | Upstream | Fork (`omp-local`) |
|---|---|---|
| Superpowers | [obra/superpowers](https://github.com/obra/superpowers) | [glockyco/superpowers](https://github.com/glockyco/superpowers/tree/omp-local) |
| Plannotator | [backnotprop/plannotator](https://github.com/backnotprop/plannotator) | [glockyco/plannotator](https://github.com/glockyco/plannotator/tree/omp-local) |

`omp-local` branches carry minimal OMP-specific adapters on top of `upstream/main`. To pull a fresh upstream: `bun run update-<plugin>` → bump `currentCommit` in `manifests/plugins.yml` → `bun run verify`. If you fork this repo, point the manifest at your own forks.

## Zed integration

`bun run bootstrap` registers `omp-acp` in `~/.config/zed/settings.json`; everything else is untouched. C# LSP is intentionally split: Zed uses Roslyn for IDE use, OMP uses `csharp-ls` for headless agent ops. See [`AGENTS.md`](./AGENTS.md#zed-integration) for rationale and contingency details.

## LSP

Three layers: binaries on `$PATH` (`scripts/install-lsp.sh`) → global overrides (`agent/lsp.json`) → per-project `./lsp.json` for genuine deviations only. `bun run audit-lsp` surfaces gaps. See [`AGENTS.md`](./AGENTS.md#lsp-maintenance) for policy.

## License

[MIT](./LICENSE) — working on this repo? See [`AGENTS.md`](./AGENTS.md).
