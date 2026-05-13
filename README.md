# OMP Agent Setup

[![CI](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml/badge.svg)](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml)

Version-controlled global setup for [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi) agent tooling.

This repository is the source of truth; the deployed runtime lives under `~/.omp/agent/` and is managed by a small Bun CLI.

## Quickstart

```bash
gh repo clone glockyco/omp-agent-setup ~/Projects/omp-agent-setup
cd ~/Projects/omp-agent-setup
bun install
bun run bootstrap
bun run verify
```

`bootstrap` snapshots existing OMP config files into `backups/<UTC-timestamp>/`, deploys managed symlinks, removes stale legacy-Pi temp-mirror symlinks from `~/.omp/agent/skills/`, merges managed keys into `~/.omp/agent/config.yml` while preserving unrelated user keys, and reconciles the plugin checkouts declared in [`manifests/plugins.yml`](./manifests/plugins.yml).

`bun run --help` lists every command. Two non-obvious flags:

- `OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify` — skip the model-heavy Superpowers acceptance smoke.
- `bun run doctor` — reports the current health of managed symlinks, config, and plugin checkouts without changing anything.

## Plugin repositories

Plugins are separate Git checkouts under `~/Projects/`; this repo only records desired remotes and branches in [`manifests/plugins.yml`](./manifests/plugins.yml).

| Plugin | Upstream | Local fork |
| --- | --- | --- |
| Superpowers | [obra/superpowers](https://github.com/obra/superpowers) | [glockyco/superpowers](https://github.com/glockyco/superpowers/tree/omp-local) |
| Plannotator | [backnotprop/plannotator](https://github.com/backnotprop/plannotator) | [glockyco/plannotator](https://github.com/glockyco/plannotator/tree/omp-local) |

Locally adapted changes live on the `omp-local` branch of each fork.

## Rollback

Every `bootstrap` writes `backups/<UTC-timestamp>/manifest.json` recording exactly what was captured. To restore a previous state, copy entries back to their original paths or remove the managed symlinks under `~/.omp/agent/` and rerun `bootstrap`.

## License

[MIT](./LICENSE).
