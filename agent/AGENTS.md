# Global OMP agent guidance

Loaded by every oh-my-pi (`omp`) session. Source-of-truth: `glockyco/omp-agent-setup/agent/AGENTS.md`. Edit there, not the deployed symlink.

## Harness

Primary harness is [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) from iTerm. Don't assume regular Pi behavior unless verified against OMP. Prefer `.omp` paths over `.pi`, and `AGENTS.md` over `CLAUDE.md`.

## OMP-native workflow

Use OMP's native workflow and tools: scope the change, research existing code, decompose only when useful, implement the clean cut, verify with evidence, then clean up. User and project instructions override this global file. Small isolated reversible edits may stay direct. Changes that span subsystems, gain callers, affect deployment/config, or outlive one session use `/plan`, `docs/plans/`, task subagents, or Plannotator review as appropriate.

Skills load via OMP's `skills.customDirectories`. Full skill bodies are available on demand through `skill://<name>`. For current platform behavior, prefer OMP docs (`omp://context-files.md`, `omp://skills.md`, `omp://task-agent-discovery.md`, `omp://tools/task.md`, `omp://system-prompt-customization.md`) over stale local process lore.

## Planning files

Planning artifacts live in `docs/plans/` in every repo (planless repos are fine
until the first plan). Before resuming multi-session work, run `omp-plans
status`. `omp-plans index`/`check` maintain `docs/plans/INDEX.md` navigation
and validate front-matter. When work covered by a plan/spec is complete, run
`omp-plans complete <slug>` before the final response so implemented docs leave
the active list. Full convention: `skill://planning-files`.

## Design assistance

Impeccable is available globally for frontend/design work. Use project `PRODUCT.md`/`DESIGN.md` when present. Don't impose visual redesigns on non-UI tasks.

## Writing style

Avoid semicolons in prose. Split the thought into separate sentences, or use a comma or colon when appropriate. Semicolons in code are unaffected.

## Conventions and recovery

Files under `~/.omp/agent/` (`AGENTS.md`, `extensions/omp-session-env.ts`, `lsp.json`, `skills/<name>/`, managed keys in `config.yml`) are owned by `glockyco/omp-agent-setup`. Managed skill names live in `src/managed-skills.ts`. Don't edit deployed copies directly. Change the source in `~/Projects/omp-agent-setup/` and run `bun run bootstrap` (`bun run doctor` for a health check, `bun run verify` for the full gate). Commit guidance lives in `skill://commit`. Documentation guidance lives in `skill://writing-project-readmes` and `skill://writing-agent-instructions`. Don't add repo-local plugin or skill copies unless a repo needs a genuine override.

If Plannotator seems inactive, verify `~/Projects/plannotator/apps/pi-extension/` is built and that `bun run doctor` sees the managed extension/config surfaces.
