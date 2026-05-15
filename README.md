# OMP Agent Setup

[![CI](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml/badge.svg)](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

My personal global setup for [oh-my-pi](https://github.com/can1357/oh-my-pi), a coding-agent harness that runs on Bun. This repository is the source of truth for what gets deployed to `~/.omp/agent/` on my machine. A small Bun CLI handles the deployment.

It's published so I can clone it onto a fresh machine and have my agent environment in one command. Public so I don't have to make it private. Reuse the parts you like, but treat it as a config dotfile, not a packaged tool. The paths, the plugin fork choices, and the bundle of conventions are mine.

## What it does

- Symlinks managed files (`agent/AGENTS.md`, `extensions/superpowers-bootstrap.ts`) into `~/.omp/agent/`.
- Merges managed keys into `~/.omp/agent/config.yml`, preserving any unrelated keys already there.
- Pins specific commits of my two plugin forks ([superpowers](https://github.com/glockyco/superpowers/tree/omp-local), [plannotator](https://github.com/glockyco/plannotator/tree/omp-local)) at `manifests/plugins.yml` and reconciles them on `bootstrap`.
- Re-applies the in-place source modifications declared in `src/patches.ts` against the globally installed `@oh-my-pi/pi-coding-agent` package, so `omp update` doesn't silently strip them.
- Ships an in-process verify suite that exercises real oh-my-pi loading plus a Superpowers acceptance smoke.

## Conventions baked in

These are choices, not requirements. Nothing in oh-my-pi forces any of them.

- **Plugin checkouts** live under `~/Projects/{superpowers,plannotator}`.
- **Forks live at `glockyco/<name>`** on a branch called `omp-local`. The branches carry minimal OMP-specific adapters on top of `upstream/main` so rebases stay near-conflict-free.
- **Bootstrap is reversible**: every run snapshots the pre-deploy state to `backups/<UTC-timestamp>/manifest.json`. Rollback is `cp` from there.

If you copy this, expect to change `manifests/plugins.yml` to point at your own forks (or just at the upstreams), and likely the checkout paths in the same file.

## Requirements

[Bun](https://bun.sh/) (version pinned in [`.bun-version`](./.bun-version)), [oh-my-pi](https://github.com/can1357/oh-my-pi) installed and on `PATH`, `gh` for cloning the plugin forks.

## Quickstart

```bash
gh repo clone glockyco/omp-agent-setup ~/Projects/omp-agent-setup
cd ~/Projects/omp-agent-setup
bun install
bun run bootstrap
bun run verify
```

`bootstrap` is idempotent. Re-run after any source change.

## What gets deployed

| Repo source | Deployed at | Semantics |
|---|---|---|
| `agent/AGENTS.md` | `~/.omp/agent/AGENTS.md` | symlink |
| `agent/lsp.json` | `~/.omp/agent/lsp.json` | symlink — global LSP overrides deep-merged into OMP's `defaults.json` |
| `extensions/superpowers-bootstrap.ts` | `~/.omp/agent/extensions/superpowers-bootstrap.ts` | symlink |
| managed keys in `config/config.yml.template` | `~/.omp/agent/config.yml` | merged YAML, unrelated keys preserved |
| `manifests/plugins.yml` | `~/Projects/{superpowers,plannotator}` | git clone + `omp-local` reconciled to pinned `currentCommit` |
| `src/patches.ts` | files under `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/` | literal-block patches applied in place, pre-patch contents captured to the snapshot, no-op when the `appliedSignature` is already present |

## Commands

| Script | Purpose |
|---|---|
| `bun run bootstrap` | Deploy / redeploy managed files. |
| `bun run verify` | Full live gate. `OMP_VERIFY_SKIP_ACCEPTANCE=1` skips the model-heavy smoke. |
| `bun run doctor` | Read-only health report. |
| `bun run audit-lsp` | Fleet audit: per-repo active / dormant servers + coverage gaps for active repos. `--include-dormant` to widen. |
| `bun run install-lsp` | Install all LSP binaries listed in `scripts/install-lsp.sh` via the canonical channel per tool. Idempotent. |
| `bun run update-{superpowers,plannotator}` | Rebase the fork's `omp-local` onto upstream and print the new SHA. |
| `bun run ci` / `bun run fix` | All quality gates / Biome auto-fix. |

## LSP

OMP's `lsp` tool auto-detects language servers per directory: walk OMP's `defaults.json`, match root markers against `cwd`, then resolve each candidate's command on `$PATH`. Three layers of configuration, all owned by this repo:

1. **Binaries on `$PATH`.** `scripts/install-lsp.sh` is the single source of truth for which servers exist and how they get there. One channel per tool: `bun add -g` for JS/TS, `uv tool install` for Python, `rustup component add` for Rust, `dotnet tool install -g` for .NET, `brew install` for standalone Rust binaries. `bun run install-lsp` runs it idempotently.
2. **Global override `agent/lsp.json`** → `~/.omp/agent/lsp.json` (symlink). Deep-merged over OMP's defaults. Swaps `omnisharp` for `csharp-ls` (Microsoft put OmniSharp in maintenance mode), tightens noisy root markers (e.g. `svelte`'s bare `package.json` fallback), and disables defaults whose binary isn't part of the install matrix (`intelephense`, `ols`, `vimls`, `emmet-language-server`, …) so they don't show up in audit gaps.
3. **Repo-local `./lsp.json`** — only when a single project genuinely needs to deviate (Deno-only repo, vendored toolchain). Don't add prophylactically; they go stale.

Individual repos never need an `lsp.json`. Auditing the fleet is the verification mechanism: `bun run audit-lsp` walks `~/Projects/*`, applies OMP's per-cwd detection (root marker match + binary resolution + project-local bin precedence) to every workspace sub-package it can enumerate (pnpm / bun / Cargo / Maven / Gradle / `.sln`), classifies repos by last-commit age (active ≤ 90d, warm ≤ 365d, dormant beyond), and surfaces coverage gaps grouped by missing server. Two known divergences from OMP's `loadConfig`: plugin-root configs are not scanned, and workspace-file parsing is best-effort (parse failures degrade to root-only coverage for that repo). Both are conservative — the audit may understate sub-package detail but never claims a server is active when it isn't. Re-runs in seconds.

## Plugins

| Plugin | Upstream | My fork (`omp-local`) |
|---|---|---|
| Superpowers | [`obra/superpowers`](https://github.com/obra/superpowers) | [`glockyco/superpowers`](https://github.com/glockyco/superpowers/tree/omp-local) |
| Plannotator | [`backnotprop/plannotator`](https://github.com/backnotprop/plannotator) | [`glockyco/plannotator`](https://github.com/glockyco/plannotator/tree/omp-local) |

The `omp-local` branches carry OMP-specific adapters on top of `upstream/main`. To pull a fresh upstream into a fork: `bun run update-<plugin>` → `bun run verify` → push `omp-local` with `--force-with-lease` → bump `manifests/plugins.yml` `currentCommit`.

## Updating OMP

`omp update` reinstalls the `@oh-my-pi/pi-coding-agent` package, which overwrites the source files our `src/patches.ts` modifies. The expected flow:

```bash
omp update                       # update the binary and bundled package
cd ~/Projects/omp-agent-setup
bun run bootstrap                # re-apply patches; managed files unchanged
bun run verify                   # optional: confirm subagents still work
```

Healthy installs are a no-op (`OMP patches: N skip-already-applied`). If the planner reports `skip-anchor-missing` for a patch, OMP rewrote the surrounding code enough that the literal-block replacement no longer matches — update the patch's `anchor` and `replacement` in `src/patches.ts` to match the new shape, then re-run `bootstrap`. `tests/patches.test.ts` documents the planner contract.

## Troubleshooting

`bun run doctor` reports what's wrong without changing anything. Every `bootstrap` writes `backups/<UTC-timestamp>/manifest.json` recording the pre-deploy state of every file it touched. OMP's own logs live at `~/.omp/logs/omp.YYYY-MM-DD.log`. The `verify` log-scan step flags new extension-load errors there.

## Rollback

The latest `backups/<UTC-timestamp>/` contains the exact pre-deploy state. Restore by copying entries back to their original paths, or remove the managed symlinks under `~/.omp/agent/` and re-run `bootstrap`.

## License

[MIT](./LICENSE). Working on this repo? See [`AGENTS.md`](./AGENTS.md).
