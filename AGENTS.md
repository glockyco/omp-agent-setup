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

Zed runs OMP via ACP (`omp acp`); the entry under `agent_servers["omp-acp"]` is owned by this repo and merged into `~/.config/zed/settings.json` by `bun run bootstrap`. The merger (`src/zed-settings.ts`) edits JSONC at character offsets via `jsonc-parser` (`modify` / `applyEdits` for writes, `findNodeAtLocation` + `getNodeValue` for reads, `parseTree(text, errors)` to fail closed on syntactically-broken user input). Comments and unrelated keys are preserved. The merged path is snapshotted to `backups/<UTC>/` on every bootstrap.

The `omp` binary path written into the managed entry is resolved at bootstrap time via `Bun.which("omp")`, not baked into source — GUI-launched Zed on macOS does not always inherit the shell's PATH, so absolute paths are safer.

C# LSP is split intentionally: Zed → Roslyn (its default, ships via the `csharp` Zed extension), OMP → csharp-ls (via `agent/lsp.json`). Roslyn is Zed's actively-maintained first-party C# server; csharp-ls is sufficient for headless `lsp` ops and avoids the third-party-extension footprint inside Zed. Known asymmetries: csharp-ls disables analyzers by default and source-generator support is in-progress; Razor/CSHTML is not supported in either path today (Zed C# extension #41). Don't try to force parity.

OmniSharp remains a documented contingency for when [Zed #55746](https://github.com/zed-industries/zed/issues/55746) bites and a working C# LSP is urgent. It is not deprecated (latest release 1.39.15 in 2025-11) but it is not the steady state either.

If a new Zed key needs to be managed, add it to `MANAGED_ZED_KEYS` and extend `buildManagedZedSettings` in `src/zed-settings.ts`, then add a test in `tests/zed-settings.test.ts`.

## OMP update

`omp update` reinstalls `@oh-my-pi/pi-coding-agent` and reverts anything our `src/patches.ts` modifies in place. Run `bun run bootstrap` after every `omp update` to re-apply. A healthy install reports `OMP patches: N skip-already-applied`. A `skip-anchor-missing` means OMP rewrote the surrounding code — update the patch's `anchor`/`replacement` in `src/patches.ts` to match the new shape and re-run `bootstrap`.

## Env contract

The `superpowers-bootstrap` extension's `session_start` handler exports session-scoped paths to `process.env` so subprocesses can resolve OMP internal URIs without relying on the bash-tool expansion path:

| Var | Value |
|---|---|
| `OMP_LOCAL_DIR` | `<artifactsDir>/local` (the `local://` root) |
| `OMP_SESSION_DIR` | per-session artifacts directory |
| `OMP_SESSION_ID` | session UUID |
| `OMP_AGENT_DIR` | `$PI_CODING_AGENT_DIR` or `~/.omp/agent` |

Consumed by plannotator's standalone CLI when invoked outside OMP-bash. Available to anything else that wants it.
