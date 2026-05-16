# AGENTS.md

Source-of-truth for my personal global [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) agent setup. Deploys managed files to `~/.omp/agent/`, owns the plugin-fork manifest, ships a small Bun CLI. The deployed-global guidance lives in [`agent/AGENTS.md`](./agent/AGENTS.md).

## Setup

`bun install`. Runtime pinned via `.bun-version`.

## Commands

| Script | What it does |
|---|---|
| `bun run bootstrap` | Deploy managed symlinks, merge managed config keys, reconcile plugin checkouts. Idempotent. |
| `bun run verify` | Live gate. `OMP_VERIFY_SKIP_ACCEPTANCE=1` skips the model-heavy Superpowers acceptance smoke. |
| `bun run doctor` | Read-only health report. |
| `bun run audit-lsp` | Fleet-wide LSP audit. Walks `~/Projects/*`, simulates OMP's per-directory server detection, classifies by git activity, surfaces missing-binary gaps. |
| `bun run install-lsp` | Idempotent install of every LSP binary in the canonical channel (bun / uv / rustup / dotnet tool / brew). Source-of-truth: `scripts/install-lsp.sh`. |
| `bun run update-{superpowers,plannotator}` | Rebase the fork's `omp-local` onto `upstream/main` and print the new SHA to record. |
| `bun run ci` | Lint + types + dead-code + audit + tests. Mirrors lefthook `pre-push` and the GitHub workflow. |
| `bun run fix` | Biome auto-fix. |

## Architecture

Pure logic lives in `src/<name>.ts`. Real-IO adapters live in `src/<name>-runtime.ts` and the CLI glue in `src/cli.ts`. Both are excluded from coverage so the 0.8 threshold gates pure logic only. Tests in `tests/`, integration tests under `tests/integration/` use a sandboxed `HOME`. Deployed payloads live in `agent/` and `extensions/`; managed local skills live under `agent/skills/{commit,writing-project-readmes,writing-agent-instructions,writing-omp-skills}/`.

New pure logic gets unit tests before merge. Real-IO behaviour stays in `*-runtime.ts` and is injected into pure functions via parameters. See how `executeCheckoutSteps(steps, runner, probe)` takes its runtime as arguments.

## Commits

Use Conventional Commits (`skill://commit`). Lefthook enforces lint + typecheck at `pre-commit` and the full `bun run ci` at `pre-push`; GitHub merges are rebase-only with auto-branch-delete.

## Boundaries

| Don't | Instead |
|---|---|
| Edit deployed copies under `~/.omp/agent/` | Edit the source in `agent/` or `extensions/`, then `bun run bootstrap`. Managed skill sources live under `agent/skills/<name>/SKILL.md`. |
| Add relative imports outside `extensions/` to `superpowers-bootstrap.ts` | Inline the helper. The file is symlinked, so relative imports resolve against the symlink path and break the loader (commit `c313a49`). |
| Take a runtime dep on `@oh-my-pi/pi-coding-agent` | Use the ambient declaration in `types/omp.d.ts` (whitelisted in `knip.json`). |
| Bypass the manifest when changing a plugin checkout | `bun run update-<plugin>` rebases `omp-local`, then update `manifests/plugins.yml` `currentCommit`. |
| Suppress acceptance smoke patterns to silence `verify` | Broaden them in `src/cli.ts:cmdVerify` to match what real agents emit. |
| Land non-OMP-specific changes on a plugin's `omp-local` branch | Keep `omp-local` as a minimal adapter on `upstream/main`. The recent superpowers audit cut 380 lines of unrelated rewrites. Treat plannotator the same way. |
| Hand-edit installed `pi-coding-agent` sources to keep a modification across `omp update` | Add the modification to `src/patches.ts` (anchor + replacement + appliedSignature) and let `bun run bootstrap` re-apply it. |
| Add an `lsp.json` to a user project to "fix" missing LSP coverage | The fleet is configured globally. Either install the missing binary via `scripts/install-lsp.sh` (preferred) or extend `agent/lsp.json`. Per-repo overrides only when project conventions genuinely differ. |
| Hand-edit `~/.config/zed/settings.json` for managed keys (`agent_servers.omp-acp`) | Change the source in `src/zed-settings.ts` (`MANAGED_ZED_KEYS` + `buildManagedZedSettings`), then `bun run bootstrap`. Other keys (`languages`, `theme`, panel placements) are user-owned and ignored by the merge. |

## LSP maintenance

LSP coverage is owned by this repo end-to-end. Individual user projects never carry LSP config. Three layers, all maintained here:

- **`scripts/install-lsp.sh`** declares which binaries exist on `$PATH` and via which channel.
- **`agent/lsp.json`** declares which servers are disabled, which root markers we tighten, and which servers we substitute (e.g. `omnisharp` → `csharp-ls`). Symlinked to `~/.omp/agent/lsp.json` by `bun run bootstrap`.
- **`scripts/audit-lsp` via `src/lsp-audit.ts` + `-runtime.ts`** is the verification mechanism. `bun run audit-lsp` re-applies OMP's detection algorithm and reports drift.

Touching any one of these implies updating the audit's view of "active fleet" and the override accordingly. If a new language enters the active fleet, install the binary in `scripts/install-lsp.sh` first; only add an `agent/lsp.json` entry if the default needs changing.

## Zed integration

`bun run bootstrap` merges `agent_servers["omp-acp"]` into `~/.config/zed/settings.json` via `src/zed-settings.ts` (`MANAGED_ZED_KEYS` + `buildManagedZedSettings`). The merger uses `jsonc-parser` `modify`/`applyEdits` at character offsets, preserves comments and unrelated keys, and fails closed via `parseTree(text, errors)` on syntactically-broken user input. The `omp` binary path is resolved at bootstrap time via `Bun.which("omp")` so the entry uses an absolute path.

C# LSP is split intentionally: Zed → Roslyn (IDE), OMP → csharp-ls (headless). Rationale, trade-offs (Razor/CSHTML, analyzer defaults, source-generator gap), and the OmniSharp contingency live in [`README.md`](./README.md#zed-integration).

To manage a new Zed key, extend `MANAGED_ZED_KEYS` and `buildManagedZedSettings` in `src/zed-settings.ts`, then add a test in `tests/zed-settings.test.ts`.

## OMP update

Run `bun run bootstrap` after every `omp update` to re-apply patches; a healthy install reports `OMP patches: N skip-already-applied`. If `bootstrap` reports `skip-anchor-missing`, OMP rewrote the surrounding code — update the patch's `anchor`/`replacement` in `src/patches.ts` to match the new shape and re-run.

## Env contract

The `superpowers-bootstrap` extension's `session_start` handler exports session-scoped paths to `process.env` so subprocesses can resolve OMP internal URIs without relying on the bash-tool expansion path:

| Var | Value |
|---|---|
| `OMP_LOCAL_DIR` | `<artifactsDir>/local` (the `local://` root) |
| `OMP_SESSION_DIR` | per-session artifacts directory |
| `OMP_SESSION_ID` | session UUID |
| `OMP_AGENT_DIR` | `$PI_CODING_AGENT_DIR` or `~/.omp/agent` |

Consumed by plannotator's standalone CLI when invoked outside OMP-bash. Available to anything else that wants it.
