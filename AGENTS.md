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
| `bun run update-{superpowers,plannotator}` | Rebase the fork's `omp-local` onto `upstream/main` and print the new SHA to record. |
| `bun run ci` | Lint + types + dead-code + audit + tests. Mirrors lefthook `pre-push` and the GitHub workflow. |
| `bun run fix` | Biome auto-fix. |

## Architecture

Pure logic lives in `src/<name>.ts`. Real-IO adapters live in `src/<name>-runtime.ts` and the CLI glue in `src/cli.ts`. Both are excluded from coverage so the 0.8 threshold gates pure logic only. Tests in `tests/`, integration tests under `tests/integration/` use a sandboxed `HOME`. Deployed payloads in `agent/` and `extensions/`.

New pure logic gets unit tests before merge. Real-IO behaviour stays in `*-runtime.ts` and is injected into pure functions via parameters. See how `executeCheckoutSteps(steps, runner, probe)` takes its runtime as arguments.

## Code style

TypeScript strict. Biome enforces format and lint, and `bun run fix` rewrites.

## Commits

Conventional Commits format, enforced by commitlint at `commit-msg`. The subject is imperative, around 50 characters, capitalized, no trailing period. The body explains the change and the reasoning. The diff already shows the mechanics. Wrap the body at 72.

Lefthook runs Biome + `tsc` on staged files at `pre-commit` and `bun install --frozen-lockfile && bun run ci` at `pre-push`. GitHub merge mode is rebase-only with auto-branch-delete.

## Boundaries

| Don't | Instead |
|---|---|
| Edit deployed copies under `~/.omp/agent/` | Edit the source in `agent/` or `extensions/`, then `bun run bootstrap`. |
| Add relative imports outside `extensions/` to `superpowers-bootstrap.ts` | Inline the helper. The file is symlinked, so relative imports resolve against the symlink path and break the loader (commit `c313a49`). |
| Take a runtime dep on `@oh-my-pi/pi-coding-agent` | Use the ambient declaration in `types/omp.d.ts` (whitelisted in `knip.json`). |
| Bypass the manifest when changing a plugin checkout | `bun run update-<plugin>` rebases `omp-local`, then update `manifests/plugins.yml` `currentCommit`. |
| Suppress acceptance smoke patterns to silence `verify` | Broaden them in `src/cli.ts:cmdVerify` to match what real agents emit. |
| Land non-OMP-specific changes on a plugin's `omp-local` branch | Keep `omp-local` as a minimal adapter on `upstream/main`. The recent superpowers audit cut 380 lines of unrelated rewrites. Treat plannotator the same way. |
| Hand-edit installed `pi-coding-agent` sources to keep a modification across `omp update` | Add the modification to `src/patches.ts` (anchor + replacement + appliedSignature) and let `bun run bootstrap` re-apply it. |

## Plugin update

`bun run update-<plugin>` → `bun run verify` → push `omp-local` with `--force-with-lease` → update `manifests/plugins.yml` `currentCommit`.

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
