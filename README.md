# OMP Agent Setup

[![CI](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml/badge.svg)](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

My personal global setup for [oh-my-pi](https://github.com/can1357/oh-my-pi), a coding-agent harness that runs on Bun. This repository is the source of truth for what gets deployed to `~/.omp/agent/` on my machine. A small Bun CLI handles the deployment.

It's published so I can clone it onto a fresh machine and have my agent environment in one command. Public so I don't have to make it private. Reuse the parts you like, but treat it as a config dotfile, not a packaged tool. The paths, the plugin fork choices, and the bundle of conventions are mine.

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
| `agent/skills/{commit,writing-project-readmes,writing-agent-instructions,writing-omp-skills}/` | `~/.omp/agent/skills/<name>/` | symlink — global skills for commits, READMEs, agent instructions, and OMP skill authoring |
| managed keys in `src/config.ts` (`MANAGED_CONFIG`) | `~/.omp/agent/config.yml` | merged YAML, unrelated keys preserved |
| `manifests/plugins.yml` | `~/Projects/{superpowers,plannotator}` | git clone + `omp-local` reconciled to pinned `currentCommit` |
| managed keys in `src/zed-settings.ts` | `~/.config/zed/settings.json` | merged JSONC, unrelated keys and comments preserved |
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

LSP coverage is owned globally. Three layers, in install order: binaries on `$PATH` (`scripts/install-lsp.sh`), a global override (`agent/lsp.json` → `~/.omp/agent/lsp.json`), and a repo-local `./lsp.json` for genuine deviations only. Individual repos should not carry an `lsp.json`.

`bun run audit-lsp` walks `~/Projects/*`, simulates OMP's per-directory detection, and surfaces missing-binary gaps. See [`AGENTS.md`](./AGENTS.md#lsp-maintenance) for the layering policy and the audit's divergences from OMP's `loadConfig`.

## Zed integration

OMP runs inside Zed via the [Agent Client Protocol](https://github.com/zed-industries/agent-client-protocol). `bun run bootstrap` registers `omp-acp` as a custom `agent_servers` entry in `~/.config/zed/settings.json` (`{ "type": "custom", "command": "<absolute omp path>", "args": ["acp"] }`); everything else is untouched. From Zed's Agent panel you get the same OMP you drive from the TUI — reading the buffer Zed sees, writing through Zed's save pipeline, opening shells in Zed's terminal. Permission prompts gate destructive tools; "allow always" persists per project.

C# LSP is intentionally split. Zed uses Roslyn (its built-in default, via the `csharp` Zed extension); OMP uses csharp-ls (via `agent/lsp.json`). Roslyn is the actively-maintained first-party Zed C# server; csharp-ls is enough for the headless `lsp` ops the agent runs. The asymmetry is recorded: csharp-ls defaults analyzer-backed diagnostics off, source-generator support is upstream-WIP, and neither path supports Razor/CSHTML in Zed today ([extension #41](https://github.com/zed-extensions/csharp/issues/41)). Forcing parity would require shipping a third-party Zed extension for csharp-ls; not worth it.

OmniSharp remains a documented contingency: not deprecated (latest release 1.39.15 in 2025-11) but not the steady state either. If [Zed #55746](https://github.com/zed-industries/zed/issues/55746) ever recurs after a Zed update, the fallback ladder is: update Zed → set `"languages": { "CSharp": { "enable_language_server": false } }` → install OmniSharp temporarily.

The OMP ↔ Zed bridge only covers editor-visible I/O (`fs/read_text_file`, `fs/write_text_file`, `terminal/*`, `session/request_permission`). OMP's own LSP, DAP, subagent fan-out, and tool implementations all stay inside OMP — Zed does not host the agent's brain.

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
