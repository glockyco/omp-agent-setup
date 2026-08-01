# AGENTS.md

Source-of-truth for my personal global [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) agent setup. Deploys managed files to `~/.omp/agent/`, owns active plugin-fork manifests, ships a small Bun CLI. The deployed-global guidance lives in [`agent/AGENTS.md`](./agent/AGENTS.md).

## Setup

`bun install`. Runtime pinned via `.bun-version`.

## Planning

Read [`docs/plans/INDEX.md`](./docs/plans/INDEX.md) and the repository [setup maintenance overview](./docs/plans/2026-07-31-setup-maintenance-overview.md) before resuming cross-session work.

## Maintenance commands

| Script | What it does |
|---|---|
| `bun run bootstrap` | Deploy managed symlinks, merge managed config keys, reconcile plugin checkouts, re-apply OMP source patches, re-point the `omp` bin at `pi-coding-agent/src/cli.ts` (run from source), and retain the newest 20 plain timestamped snapshots (manually tagged snapshots are preserved). Idempotent. |
| `bun run verify` | Live gate for OMP smoke, skill discovery, extension logs, `omp-plans`, and `omp-skill`. |
| `bun run doctor` | Read-only health report. |
| `bun run audit-lsp` | Fleet-wide LSP audit. Walks `~/Projects/*`, simulates OMP's per-directory server detection, classifies by git activity, and surfaces each missing binary with a remediation that distinguishes `install-lsp` coverage from manual-only channels. |
| `bun run install-lsp` | Idempotent install of every LSP binary in the canonical channel for the current platform (bun / uv / rustup / dotnet tool / brew). `src/lsp-channels.ts` names the channel map; a test keeps it in exact lockstep with `scripts/install-lsp.sh`. |
| `bun run update-omp` | Read the installed OMP version, run `omp update`, then stop on the first failed bootstrap, doctor, or verify gate before reporting the resulting version. |
| `bun run update-plannotator` | Rebase the Plannotator fork's `omp-local` onto `upstream/main` and print the new SHA to record. |
| `bun run update-vendored-skill <name>` | Re-vendor one `src/optional-skills.ts` entry from its upstream default branch head, then print the old and new commits to record. Rejects a tree whose `SKILL.md` frontmatter name stopped matching the directory name. |
|`bun run update-impeccable`|Download the latest Impeccable universal bundle, vendor `.pi/skills/impeccable` (rewriting its project-local `node .pi/...` script paths to the deployed `$OMP_AGENT_DIR/skills/impeccable` location so they resolve from any project cwd), re-applying the vendor fixes and asserting the Pi provider plus clean Markdown in `src/impeccable-update.ts`, and vendor the four Claude-variant subagents into `agent/agents/` through the front-matter translation in `src/impeccable-agents.ts`. Prints old/new versions, the vendored agent count, and per-fix status for diff review.|

## Developer commands

| Script | What it does |
|---|---|
| `bun run ci` | Lint + types + dead-code + audit + tests. Mirrors lefthook `pre-push` and the GitHub workflow. |
| `bun run fix` | Biome auto-fix. |
| `bun run check:*` | CI composition and focused debugging units. |

## Architecture

Pure logic lives in `src/<name>.ts`. Real-IO adapters live in `src/<name>-runtime.ts` and the CLI glue in `src/cli.ts`. Both are excluded from coverage so the 0.8 threshold gates pure logic only. Tests in `tests/`, integration tests under `tests/integration/` use a sandboxed `HOME`. Deployed payloads live in `agent/` and `extensions/`.

Five registries name what gets deployed. Add the payload file and the registry entry in the same change: `planManagedLinks` never checks that a source exists, so a name registered ahead of its file deploys a dangling symlink.

| Registry | Payload | Deployed at |
|---|---|---|
| `src/managed-skills.ts` | `agent/skills/<name>/` | `~/.omp/agent/skills/<name>` — symlink |
| `src/managed-rules.ts` | `agent/rules/<name>.md` | `~/.omp/agent/rules/<name>.md` — symlink |
| `src/managed-agents.ts` | `agent/agents/<name>.md` | `~/.omp/agent/agents/<name>.md` — symlink |
| `src/optional-skills.ts` | `agent/optional-skills/<name>/` | `~/.omp/agent/optional-skills/<name>` — symlink, opt-in |
| `src/mcp.ts` (`MANAGED_MCP_SERVERS`) | the spec's `config` object | `~/.omp/agent/mcp.json` — merged |

Managed extensions are explicit because there are only two: add the source under `extensions/`, then update `MANAGED_CONFIG.extensions`, the snapshot/link list in `src/bootstrap.ts`, and `managedAgentChecks` in `src/cli.ts` together. `impeccable-hook.ts` delegates OMP `tool_result` and terminal `agent_end` events to the vendored skill's immediate and deep detector passes through `$OMP_AGENT_DIR`; it never imports back into this repo through a relative path.

The MCP registry covers one class of server: **Streamable HTTP, unauthenticated, readiness determined by calling a zero-argument tool**. Within that class a new server is one registry entry plus at most one `interpret` function. Anything else — stdio, SSE, auth headers, non-tool readiness — needs new runtime code in `src/mcp-runtime.ts`, not just a row. Timeouts in the registry are measured, not guessed: OMP burns roughly `0.65 x timeout` during session teardown whether or not a tool was called, so re-measure before raising one.

New pure logic gets unit tests before merge. Real-IO behaviour stays in `*-runtime.ts` and is injected into pure functions via parameters. See how `executeCheckoutSteps(steps, runner, probe)` takes its runtime as arguments.

## Optional skills

An optional skill is deployed globally but discovered nowhere. `~/.omp/agent/optional-skills/` is scanned by nothing — `~/.omp/agent/skills` (native user scan) and `~/.omp/agent/managed-skills` (auto-learn) are the only two agent-dir scans OMP performs — so the payload stays invisible in every session until a repository opts in. `omp-skill enable <name>` symlinks it to `<repo>/.omp/skills/<name>`, which OMP's native project scan finds by walking every ancestor of the session cwd, and adds `/.omp/skills/<name>` to that repo's `.git/info/exclude` so the machine-local opt-in leaves the working tree clean.

The two-hop indirection is deliberate: the repo-local marker points at a fixed `$HOME` path that itself points into this repository, so editing the payload or re-vendoring reaches every enabled repo with nothing re-run per repo. Nothing records which repos opted in — `omp-skill list --fleet` walks `~/Projects/*` and reads the filesystem, the same posture as `bun run audit-lsp`.

Removing or renaming a `LOCAL_OPTIONAL_SKILLS` entry is the one event that invalidates repo-local markers. Run `omp-skill list --fleet` afterwards: the leftovers surface as `broken` rows while the registry still knows the name and as `orphan` rows once it does not, each naming the exact path to remove. Orphan detection only claims symlinks pointing into the deploy root — a repository's own real `.omp/skills/<name>` directory belongs to that repository and is never reported.

`bun run verify` asserts the payload is *not* loaded from this repository, which has not opted in. That check is the regression guard: moving a payload into `agent/skills/` or adding a scanned directory turns it red.

## Commits

Use Conventional Commits (`skill://commit`). Lefthook enforces lint + typecheck at `pre-commit` and the full `bun run ci` at `pre-push`; GitHub merges are rebase-only with auto-branch-delete.

## Boundaries

| Don't | Instead |
|---|---|
| Edit deployed copies under `~/.omp/agent/` | Edit the source in `agent/` or `extensions/`, then `bun run bootstrap`. Managed skill sources live under `agent/skills/<name>/SKILL.md`, rules under `agent/rules/<name>.md`. |
| Symlink `~/.omp/agent/mcp.json` into the repo the way `lsp.json` is | Keep it merged. OMP writes this file itself (`/mcp add`, `/mcp disable`, `/mcp reauth`, `$schema` injection), so a symlink turns every `/mcp disable` into permanent working-tree dirt. `lsp.json` is safe to symlink precisely because OMP never writes it. |
| Install a background service from `bun run bootstrap` | Bootstrap stays idempotent and safe on any machine. Put the command in the spec's `launchdService.installCommand` and let `bun run doctor` surface it as the remediation. |
| Update Impeccable by editing `agent/skills/impeccable` or the deployed symlink | Run `bun run update-impeccable`, review the vendored diff, then `bun run bootstrap`; the update asserts the Pi provider and rejects forbidden provider/npm paths in Markdown. A change we need to survive the next re-vendor goes in `IMPECCABLE_VENDOR_FIXES` (`src/impeccable-update.ts`), which reuses `planPatch` from `src/patches.ts`; a fix reporting anything but `apply` means upstream moved the anchor, and `tests/impeccable-update.test.ts` fails if the vendored tree stops carrying one. |
| Add relative imports from a managed file under `extensions/` into this repo | Inline the helper or resolve a managed payload through `$OMP_AGENT_DIR`. Extension files are symlinked, so relative imports resolve against the deployed symlink path and break the loader. |
| Take a runtime dep on `@oh-my-pi/pi-coding-agent` | Use the ambient declaration in `types/omp.d.ts` (whitelisted in `knip.json`). |
| Bypass the manifest when changing Plannotator checkout state | `bun run update-plannotator` rebases `omp-local`, then update `manifests/plugins.yml` `currentCommit`. |
| Hand-edit installed `@oh-my-pi` package sources (`pi-coding-agent`, `pi-agent-core`, `pi-ai`) to keep a modification across `omp update` | Add the modification to `src/patches.ts` (set `package` + anchor + replacement + appliedSignature) and let `bun run bootstrap` re-apply it. Patches target **TypeScript source only** — bootstrap re-points the `omp` bin at `pi-coding-agent/src/cli.ts` so the package runs from source (Bun resolves `@oh-my-pi/*` imports to `src/`), which is what makes source patches effective at runtime. Never patch the minified `dist/cli.js`; its anchors drift on nearly every release. Each patch resolves to `node_modules/@oh-my-pi/<package>/<targetRelative>`, addressed by name — never via `../` escapes. |
| Re-point or hand-edit `~/.bun/bin/omp` to change what `omp` runs | `bun run update-omp` owns the normal update-and-repair sequence. `bun run bootstrap` is the recovery path that snapshots, then re-points the symlink to `pi-coding-agent/src/cli.ts`. |
| Add an `lsp.json` to a user project to "fix" missing LSP coverage | The fleet is configured globally. Either install the missing binary via `scripts/install-lsp.sh` (preferred) or extend `agent/lsp.json`. Per-repo overrides only when project conventions genuinely differ. |
| Register an opt-in payload in `src/managed-skills.ts` to make it easier to reach | That deploys it to `~/.omp/agent/skills/` and lists it in every session, which is the cost the opt-in exists to avoid. Register it in `src/optional-skills.ts` and run `omp-skill enable <name>` in the repos that want it. |
| Hand-create `<repo>/.omp/skills/<name>` or hand-edit `.git/info/exclude` to enable a skill | `omp-skill enable`/`disable` own both halves and refuse to touch an entry they did not create. A hand-made entry reports `foreign` and blocks. |
| Update a vendored optional skill by editing `agent/optional-skills/<name>/` | Run `bun run update-vendored-skill <name>`, record the printed commit in `src/optional-skills.ts`, review the diff, then `bun run bootstrap`. Unlike Impeccable there is no vendor-fix layer: these payloads are used verbatim, so a needed local change means the tree is no longer a clean vendor. |
| Hand-edit anything under `agent/agents/` | Those four files are generated by `bun run update-impeccable` from the bundle's `.claude/agents/`, so an edit is erased on the next re-vendor. Change the translation in `src/impeccable-agents.ts` instead. Upstream ships agent definitions in no Pi-variant directory, which is why they are translated rather than copied. |

## MCP servers

`bun run doctor` checks four things per managed server: the `mcp.json` entry still deep-equals the registry, the pinned binary is installed at its version, the launchd plist exists, and the daemon answers its readiness tool. Each failure prints its own remediation.

A server whose backing app is not running reports `note`, not `WARN`, and does not fail doctor. That is deliberate — a health report that turns red whenever the user quits an app is one they learn to ignore. Reserve `warn`/`miss` for states the user can actually fix.

No server-specific identifier belongs in `src/cli.ts`, `src/bootstrap.ts`, or `src/mcp-runtime.ts`. `grep -rn "<server>" src/cli.ts src/bootstrap.ts src/mcp-runtime.ts` returning nothing is the check that the registry is still a template.

## LSP maintenance

LSP coverage is owned by this repo end-to-end. Individual user projects never carry LSP config. Three layers, all maintained here:

- **`src/lsp-channels.ts` + `scripts/install-lsp.sh`** declare which binaries exist on `$PATH` and via which channel; `tests/lsp-audit.test.ts` parses the shell invocations and requires exact registry lockstep.
- **`agent/lsp.json`** declares which servers are disabled, which root markers we tighten, and which servers we substitute (e.g. `omnisharp` → `csharp-ls`). Symlinked to `~/.omp/agent/lsp.json` by `bun run bootstrap`.
- **`scripts/audit-lsp` via `src/lsp-audit.ts` + `-runtime.ts`** is the verification mechanism. `bun run audit-lsp` re-applies OMP's detection algorithm and reports drift.

Touching any one of these implies updating the audit's view of "active fleet" and the override accordingly. If a new language enters the active fleet, install the binary in `scripts/install-lsp.sh` first; only add an `agent/lsp.json` entry if the default needs changing.

## OMP update

Use `bun run update-omp`. It records the installed version, runs the upstream updater, then stops on the first failed bootstrap, doctor, or verify gate before recording the resulting version. Bootstrap re-points the `omp` bin at `pi-coding-agent/src/cli.ts` and re-applies source patches after the updater resets the global link.

Recovery only: if the repository command cannot start, run `omp update`, then immediately run `bun run bootstrap`, `bun run doctor`, and `bun run verify`. The `omp-session-env` extension warns at the next session start if the bin still points at the unpatched bundle. A healthy repair reports `OMP patches: N skip-already-applied` and `omp bin: skip-up-to-date` or `repoint`, plus `ok omp bin -> .../src/cli.ts` from doctor.

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
