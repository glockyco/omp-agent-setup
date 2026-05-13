# OMP Agent Setup

[![CI](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml/badge.svg)](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Version-controlled global setup for [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi) agent tooling. This repository is the source of truth; the deployed runtime lives at `~/.omp/agent/` and is managed by a small Bun CLI.

## What it does

Deploys managed files (symlinks plus merge-managed YAML) to `~/.omp/agent/`, owns the plugin-fork manifest at [`manifests/plugins.yml`](./manifests/plugins.yml), and ships an in-process verify suite that exercises real OMP loading plus a Superpowers acceptance smoke.

## Requirements

[Bun](https://bun.sh/) (pinned via [`.bun-version`](./.bun-version)), [Oh My Pi](https://github.com/can1357/oh-my-pi) installed and on `PATH`, `gh` for cloning the plugin forks.

## Quickstart

```bash
gh repo clone glockyco/omp-agent-setup ~/Projects/omp-agent-setup
cd ~/Projects/omp-agent-setup
bun install
bun run bootstrap
bun run verify
```

`bootstrap` is idempotent — re-run after any source change.

## What gets deployed

| Repo source | Deployed at | Semantics |
|---|---|---|
| `agent/AGENTS.md` | `~/.omp/agent/AGENTS.md` | symlink |
| `extensions/superpowers-bootstrap.ts` | `~/.omp/agent/extensions/superpowers-bootstrap.ts` | symlink |
| managed keys in `config/config.yml.template` | `~/.omp/agent/config.yml` | merged YAML; unrelated keys preserved |
| `manifests/plugins.yml` | `~/Projects/{superpowers,plannotator}` | git clone + `omp-local` reconciled to pinned `currentCommit` |

## Commands

| Script | Purpose |
|---|---|
| `bun run bootstrap` | Deploy / redeploy managed files. |
| `bun run verify` | Live gate. `OMP_VERIFY_SKIP_ACCEPTANCE=1` skips the model-heavy smoke. |
| `bun run doctor` | Read-only health report. |
| `bun run update-{superpowers,plannotator}` | Rebase the fork's `omp-local` onto upstream; print the new SHA. |
| `bun run ci` / `bun run fix` | All quality gates / Biome auto-fix. |

## Plugins

| Plugin | Upstream | Fork (`omp-local`) |
|---|---|---|
| Superpowers | [`obra/superpowers`](https://github.com/obra/superpowers) | [`glockyco/superpowers`](https://github.com/glockyco/superpowers/tree/omp-local) |
| Plannotator | [`backnotprop/plannotator`](https://github.com/backnotprop/plannotator) | [`glockyco/plannotator`](https://github.com/glockyco/plannotator/tree/omp-local) |

The `omp-local` branches carry OMP-specific adapters on top of `upstream/main`. To pull a fresh upstream into a fork: `bun run update-<plugin>` → `bun run verify` → push `omp-local` with `--force-with-lease` → bump `manifests/plugins.yml` `currentCommit`.

## Troubleshooting

`bun run doctor` reports what's wrong without changing anything. Every `bootstrap` writes `backups/<UTC-timestamp>/manifest.json` recording the pre-deploy state of every file it touched. OMP's own logs live at `~/.omp/logs/omp.YYYY-MM-DD.log`; the `verify` log-scan step flags new extension-load errors there.

## Rollback

The latest `backups/<UTC-timestamp>/` contains the exact pre-deploy state. Restore by copying entries back to their original paths, or remove the managed symlinks under `~/.omp/agent/` and re-run `bootstrap`.

## License

[MIT](./LICENSE). Working on this repo? See [`AGENTS.md`](./AGENTS.md).
