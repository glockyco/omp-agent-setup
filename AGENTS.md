# AGENTS.md

Source-of-truth for my personal global [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) agent setup. Deploys managed files to `~/.omp/agent/`, owns active plugin-fork manifests, ships a small Bun CLI. The deployed-global guidance lives in [`agent/AGENTS.md`](./agent/AGENTS.md).

## Setup

`bun install`. Runtime pinned via `.bun-version`.

## Commands

| Script | What it does |
|---|---|
| `bun run bootstrap` | Deploy managed symlinks, merge managed config keys, reconcile plugin checkouts, re-apply OMP source patches, and re-point the `omp` bin at `pi-coding-agent/src/cli.ts` (run from source). Idempotent. |
| `bun run verify` | Live gate for OMP smoke, skill discovery, extension logs, and `omp-plans`. |
| `bun run doctor` | Read-only health report. |
| `bun run audit-lsp` | Fleet-wide LSP audit. Walks `~/Projects/*`, simulates OMP's per-directory server detection, classifies by git activity, surfaces missing-binary gaps. |
| `bun run install-lsp` | Idempotent install of every LSP binary in the canonical channel (bun / uv / rustup / dotnet tool / brew). Source-of-truth: `scripts/install-lsp.sh`. |
| `bun run update-plannotator` | Rebase the Plannotator fork's `omp-local` onto `upstream/main` and print the new SHA to record. |
| `bun run update-impeccable` | Download the latest Impeccable universal bundle, vendor `.pi/skills/impeccable` (rewriting its project-local `node .pi/...` script paths to the deployed `$OMP_AGENT_DIR/skills/impeccable` location so they resolve from any project cwd), and print old/new versions for diff review. |
| `bun run ci` | Lint + types + dead-code + audit + tests. Mirrors lefthook `pre-push` and the GitHub workflow. |
| `bun run fix` | Biome auto-fix. |

## Architecture

Pure logic lives in `src/<name>.ts`. Real-IO adapters live in `src/<name>-runtime.ts` and the CLI glue in `src/cli.ts`. Both are excluded from coverage so the 0.8 threshold gates pure logic only. Tests in `tests/`, integration tests under `tests/integration/` use a sandboxed `HOME`. Deployed payloads live in `agent/` and `extensions/`; managed local skills are the names in `src/managed-skills.ts` under `agent/skills/<name>/`.

New pure logic gets unit tests before merge. Real-IO behaviour stays in `*-runtime.ts` and is injected into pure functions via parameters. See how `executeCheckoutSteps(steps, runner, probe)` takes its runtime as arguments.

## Commits

Use Conventional Commits (`skill://commit`). Lefthook enforces lint + typecheck at `pre-commit` and the full `bun run ci` at `pre-push`; GitHub merges are rebase-only with auto-branch-delete.

## Boundaries

| Don't | Instead |
|---|---|
| Edit deployed copies under `~/.omp/agent/` | Edit the source in `agent/` or `extensions/`, then `bun run bootstrap`. Managed skill sources live under `agent/skills/<name>/SKILL.md`. |
| Update Impeccable by editing `agent/skills/impeccable` or the deployed symlink | Run `bun run update-impeccable`, review the vendored diff, then `bun run bootstrap`. |
| Add relative imports outside `extensions/` to `omp-session-env.ts` | Inline the helper. The file is symlinked, so relative imports resolve against the symlink path and break the loader. |
| Take a runtime dep on `@oh-my-pi/pi-coding-agent` | Use the ambient declaration in `types/omp.d.ts` (whitelisted in `knip.json`). |
| Bypass the manifest when changing Plannotator checkout state | `bun run update-plannotator` rebases `omp-local`, then update `manifests/plugins.yml` `currentCommit`. |
| Hand-edit installed `@oh-my-pi` package sources (`pi-coding-agent`, `pi-agent-core`, `pi-ai`) to keep a modification across `omp update` | Add the modification to `src/patches.ts` (set `package` + anchor + replacement + appliedSignature) and let `bun run bootstrap` re-apply it. Patches target **TypeScript source only** — bootstrap re-points the `omp` bin at `pi-coding-agent/src/cli.ts` so the package runs from source (Bun resolves `@oh-my-pi/*` imports to `src/`), which is what makes source patches effective at runtime. Never patch the minified `dist/cli.js`; its anchors drift on nearly every release. Each patch resolves to `node_modules/@oh-my-pi/<package>/<targetRelative>`, addressed by name — never via `../` escapes. |
| Re-point or hand-edit `~/.bun/bin/omp` to change what `omp` runs | `bun run bootstrap` owns the bin (`src/bin-link.ts` + `-runtime.ts`): it snapshots, then re-points the symlink to `pi-coding-agent/src/cli.ts`. `omp update` resets it to `dist/cli.js` — just re-run bootstrap. |
| Add an `lsp.json` to a user project to "fix" missing LSP coverage | The fleet is configured globally. Either install the missing binary via `scripts/install-lsp.sh` (preferred) or extend `agent/lsp.json`. Per-repo overrides only when project conventions genuinely differ. |

## LSP maintenance

LSP coverage is owned by this repo end-to-end. Individual user projects never carry LSP config. Three layers, all maintained here:

- **`scripts/install-lsp.sh`** declares which binaries exist on `$PATH` and via which channel.
- **`agent/lsp.json`** declares which servers are disabled, which root markers we tighten, and which servers we substitute (e.g. `omnisharp` → `csharp-ls`). Symlinked to `~/.omp/agent/lsp.json` by `bun run bootstrap`.
- **`scripts/audit-lsp` via `src/lsp-audit.ts` + `-runtime.ts`** is the verification mechanism. `bun run audit-lsp` re-applies OMP's detection algorithm and reports drift.

Touching any one of these implies updating the audit's view of "active fleet" and the override accordingly. If a new language enters the active fleet, install the binary in `scripts/install-lsp.sh` first; only add an `agent/lsp.json` entry if the default needs changing.

## OMP update

Run `bun run bootstrap` after every `omp update`. It re-points the `omp` bin at `pi-coding-agent/src/cli.ts` and re-applies the source patches. A healthy install reports `OMP patches: N skip-already-applied` and `omp bin: skip-up-to-date` (or `repoint` the first run after an update reset the bin to the bundle); confirm with `bun run doctor` (`ok omp bin -> .../src/cli.ts`).

Two drift signals need action:
- `skip-anchor-missing` — OMP rewrote the patched source; update the patch's `anchor`/`replacement` in `src/patches.ts` to the new shape and re-run.
- `omp bin not pointed at source` (plan `skip-source-unusable`) — `pi-coding-agent/src/cli.ts` is missing or non-executable (e.g. a dist-only publish). Bootstrap leaves the existing bin intact so `omp` keeps running; investigate the install before forcing a re-point.

## Env contract

The `omp-session-env` extension's `session_start` handler exports session-scoped paths and lightweight runtime defaults to `process.env` so subprocesses can resolve OMP internal URIs without relying on the bash-tool expansion path and tool providers can avoid heavyweight defaults:

| Var | Value |
|---|---|
| `OMP_LOCAL_DIR` | `<artifactsDir>/local` (the `local://` root) |
| `OMP_SESSION_DIR` | per-session artifacts directory |
| `OMP_SESSION_ID` | session UUID |
| `OMP_AGENT_DIR` | `$PI_CODING_AGENT_DIR` or `~/.omp/agent` |
| `PI_CODEX_WEB_SEARCH_MODEL` | `gpt-5.4-mini` unless already set |

Consumed by Plannotator's standalone CLI when invoked outside OMP-bash. Available to anything else that wants it.
