# OMP Agent Setup

Source-of-truth for a global [oh-my-pi](https://github.com/can1357/oh-my-pi) agent environment.
A Bun CLI deploys, merges, reconciles, and patches everything into place.

This is a personal clone-to-own dotfile, not a packaged tool. The paths, plugin forks, and
conventions are mine; reuse whatever parts you like.

[![CI](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml/badge.svg)](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## What this repository does

`bun run bootstrap` manages five kinds of surfaces across the local machine:

```text
this repo (source of truth)
  → bun run bootstrap
      → symlinks        ~/.omp/agent/{AGENTS.md, lsp.json, extensions/, skills/}
      → deep merge      ~/.omp/agent/config.yml          (managed keys; others preserved)
      → deep merge      ~/.config/zed/settings.json      (agent_servers.omp-acp; others preserved)
      → reconcile       ~/Projects/{superpowers,plannotator}  (git clone + omp-local at pinned commit)
      → patch in place  ~/.bun/install/.../pi-coding-agent/src/  (re-applied after every omp update)
```

All operations are idempotent. Every run snapshots the pre-deploy state to
`backups/<UTC-timestamp>/manifest.json` before touching anything.

## Requirements

- [Bun](https://bun.sh/) 1.3.14 (pinned in [`.bun-version`](./.bun-version))
- [oh-my-pi](https://github.com/can1357/oh-my-pi) installed and on `PATH`
- `gh` (GitHub CLI) for first-time plugin clone

## Quickstart

```bash
gh repo clone glockyco/omp-agent-setup ~/Projects/omp-agent-setup
cd ~/Projects/omp-agent-setup
bun install --frozen-lockfile
bun run bootstrap
OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify
```

Drop `OMP_VERIFY_SKIP_ACCEPTANCE=1` once to run the full Superpowers acceptance smoke (slow,
model-heavy, costs API calls).

## What bootstrap manages

| Source | Deployed target | Operation |
|---|---|---|
| `agent/AGENTS.md` | `~/.omp/agent/AGENTS.md` | symlink |
| `agent/lsp.json` | `~/.omp/agent/lsp.json` | symlink |
| `extensions/superpowers-bootstrap.ts` | `~/.omp/agent/extensions/superpowers-bootstrap.ts` | symlink |
| `agent/skills/{commit,writing-project-readmes,writing-agent-instructions,writing-omp-skills}/` | `~/.omp/agent/skills/<name>/` | symlink |
| managed keys in `src/config.ts` | `~/.omp/agent/config.yml` | deep merge — unrelated keys preserved |
| `manifests/plugins.yml` | `~/Projects/{superpowers,plannotator}` | checkout reconciled to pinned `omp-local` commit |
| managed keys in `src/zed-settings.ts` | `~/.config/zed/settings.json` | deep merge — unrelated keys and comments preserved |
| `src/patches.ts` | files under `~/.bun/install/global/.../pi-coding-agent/src/` | patch applied in place |

## Repository layout

| Path | Purpose |
|---|---|
| `agent/` | Deployed payloads: global `AGENTS.md`, LSP overrides, and managed skills |
| `extensions/` | `superpowers-bootstrap.ts` — loaded at every OMP session start |
| `src/` | CLI and pure-logic modules; `*-runtime.ts` files hold real-IO adapters |
| `manifests/` | `plugins.yml` — plugin fork sources, branches, and pinned commits |
| `scripts/` | `install-lsp.sh` — canonical LSP binary install channel |
| `config/` | Config and Plannotator templates used during bootstrap |
| `tests/` | Unit tests; `tests/integration/` uses a sandboxed `HOME` |
| `docs/` | Design specs and implementation plans |
| `backups/` | Pre-deploy snapshots written by each bootstrap run (gitignored) |

## Common commands

| Script | Purpose | Writes state? |
|---|---|---|
| `bun run bootstrap` | Deploy / reconcile all managed surfaces | Yes — idempotent |
| `bun run verify` | Full live gate; `OMP_VERIFY_SKIP_ACCEPTANCE=1` skips the model-heavy smoke | No |
| `bun run doctor` | Read-only health report | No |
| `bun run audit-lsp` | Fleet audit: per-repo active / dormant servers + coverage gaps; `--include-dormant` to widen | No |
| `bun run install-lsp` | Install all LSP binaries listed in `scripts/install-lsp.sh` via the canonical channel | Yes — idempotent |
| `bun run update-superpowers` | Rebase Superpowers fork's `omp-local` onto upstream; prints new SHA | Yes |
| `bun run update-plannotator` | Rebase Plannotator fork's `omp-local` onto upstream; prints new SHA | Yes |
| `bun run ci` | Lint + types + dead-code + audit + tests | No |
| `bun run fix` | Biome auto-fix | Yes — rewrites files |

## Common workflows

### Redeploy after source changes

```bash
bun run bootstrap
```

Re-run after any change to `agent/`, `extensions/`, `src/`, or `manifests/`. Idempotent.

### Verify the environment

```bash
bun run doctor                               # read-only health report
OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify  # full gate, skip model-heavy smoke
bun run verify                               # full gate including acceptance smoke
```

### Rebase a plugin fork

```bash
bun run update-superpowers   # or update-plannotator
# prints the new omp-local commit SHA
# → update currentCommit in manifests/plugins.yml
# → git push origin omp-local --force-with-lease
bun run verify
```

### After omp update

```bash
omp update
cd ~/Projects/omp-agent-setup
bun run bootstrap   # re-applies patches; managed symlinks and merges are unchanged
```

A healthy install reports `OMP patches: N skip-already-applied`. If bootstrap reports
`skip-anchor-missing`, OMP rewrote the surrounding code — update the patch's `anchor` and
`replacement` in `src/patches.ts` to match the new shape, then re-run.

### Troubleshoot and recover

`bun run doctor` reports drift without changing anything.

OMP logs live at `~/.omp/logs/omp.YYYY-MM-DD.log`; `bun run verify`'s log-scan step flags
extension-load errors there.

Every bootstrap run writes `backups/<UTC-timestamp>/manifest.json` recording the pre-deploy state
of every managed file. To roll back: copy entries from the latest snapshot back to their original
paths, or remove the managed symlinks under `~/.omp/agent/` and re-run bootstrap.

## Integrations

### Zed

`bun run bootstrap` registers OMP as a custom `agent_servers` entry (`omp-acp`) in
`~/.config/zed/settings.json`. Everything else in that file is untouched. From Zed's Agent panel,
OMP reads and writes through Zed's buffer and save pipeline, opens shells in Zed's terminal, and
prompts for permission before destructive tools.

C# LSP is intentionally split: Zed uses Roslyn (built-in, actively maintained for IDE use); OMP
uses `csharp-ls` (via `agent/lsp.json`) for headless agent operations. See
[`AGENTS.md`](./AGENTS.md#zed-integration) for the full rationale and contingency details.

### LSP

LSP coverage is owned globally by this repo, not by individual projects. Three layers:

1. `scripts/install-lsp.sh` — declares which binaries are on `$PATH` and via which channel
2. `agent/lsp.json` → `~/.omp/agent/lsp.json` — global overrides deep-merged into OMP's defaults
3. `./lsp.json` in a specific project — per-project deviations only when conventions genuinely differ

`bun run audit-lsp` walks `~/Projects/*`, simulates OMP's server detection per directory, and
surfaces missing-binary gaps. See [`AGENTS.md`](./AGENTS.md#lsp-maintenance) for layering policy
and maintenance rules.

## Opinionated defaults

These are choices, not requirements. Nothing in oh-my-pi forces any of them.

- Plugin checkouts live under `~/Projects/{superpowers,plannotator}`.
- Plugin forks live at `glockyco/<name>` on a branch called `omp-local`. Branches carry minimal
  OMP-specific adapters on top of `upstream/main` so rebases stay near-conflict-free.

If you copy this repo, update `manifests/plugins.yml` to point at your own forks (or the upstreams)
and change the checkout paths in the same file.

## Plugin forks

| Plugin | Upstream | My fork (`omp-local`) |
|---|---|---|
| Superpowers | [`obra/superpowers`](https://github.com/obra/superpowers) | [`glockyco/superpowers`](https://github.com/glockyco/superpowers/tree/omp-local) |
| Plannotator | [`backnotprop/plannotator`](https://github.com/backnotprop/plannotator) | [`glockyco/plannotator`](https://github.com/glockyco/plannotator/tree/omp-local) |

`omp-local` carries minimal OMP-specific adapters on top of `upstream/main`. `manifests/plugins.yml`
is the source of truth for fork URLs, branch names, and pinned commits. See
[Rebase a plugin fork](#rebase-a-plugin-fork) for the update sequence.

## Maintainers

Working on this repo? See [`AGENTS.md`](./AGENTS.md) for architecture, conventions, and
agent-specific boundaries.

## License

[MIT](./LICENSE)
