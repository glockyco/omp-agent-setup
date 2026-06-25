# Global OMP agent guidance

Loaded by every oh-my-pi (`omp`) session. Source-of-truth: `glockyco/omp-agent-setup/agent/AGENTS.md`. Edit there, not the deployed symlink.

## Harness

Primary harness is [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) from iTerm. Don't assume regular Pi behavior unless verified against OMP. Prefer `.omp` paths over `.pi`, and `AGENTS.md` over `CLAUDE.md`.

## Methodology

Methodology is [Superpowers](https://github.com/glockyco/superpowers/tree/omp-local) at `~/Projects/superpowers`. Plan/review UI is [Plannotator](https://github.com/glockyco/plannotator/tree/omp-local) at `~/Projects/plannotator`. Skills load via OMP's `skills.customDirectories`. The `using-superpowers` skill is injected at session start by the `superpowers-bootstrap` extension. User instructions always override Superpowers skills, and the user may opt out of Superpowers for tiny tasks.

## Planning files

Planning artifacts live in `docs/plans/` in every repo (planless repos are fine until the first plan). Before resuming multi-session work, run `omp-plans status`; `omp-plans index`/`check` maintain `docs/plans/INDEX.md` and validate front-matter. Full convention: `skill://planning-files`.

## Design assistance

Impeccable is available globally for frontend/design work. Use project `PRODUCT.md`/`DESIGN.md` when present; don't impose visual redesigns on non-UI tasks.

## Conventions and recovery

Files under `~/.omp/agent/` (`AGENTS.md`, `extensions/superpowers-bootstrap.ts`, `lsp.json`, `skills/{commit,writing-project-readmes,writing-agent-instructions,impeccable,planning-files}/`, managed keys in `config.yml`) are owned by `glockyco/omp-agent-setup`. Don't edit the deployed copies directly. Change the source in `~/Projects/omp-agent-setup/` and run `bun run bootstrap` (`bun run doctor` for a health check, `bun run verify` for the full gate). Commit guidance lives in `skill://commit`; documentation guidance lives in `skill://writing-project-readmes` and `skill://writing-agent-instructions`. Don't add repo-local plugin or skill copies unless a repo needs a genuine override.

If Superpowers seems inactive, verify `skill://using-superpowers` resolves and the bootstrap extension is loaded (check OMP logs). If Plannotator seems inactive, verify `~/Projects/plannotator/apps/pi-extension/` is built.
