# Global OMP agent guidance

Loaded by every oh-my-pi (`omp`) session. Source-of-truth: `glockyco/omp-agent-setup/agent/AGENTS.md`. Edit there, not the deployed symlink.

## Harness

Primary harness is [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`). Don't assume regular Pi behavior unless verified against OMP. Prefer `.omp` paths over `.pi`, and `AGENTS.md` over `CLAUDE.md`.

## Methodology

Methodology is [Superpowers](https://github.com/glockyco/superpowers/tree/omp-local) at `~/Projects/superpowers`. Plan/review UI is [Plannotator](https://github.com/glockyco/plannotator/tree/omp-local) at `~/Projects/plannotator`. Skills load via OMP's `skills.customDirectories`. The `using-superpowers` skill is injected at session start by the `superpowers-bootstrap` extension. User instructions always override Superpowers skills, and the user may opt out of Superpowers for tiny tasks.

## Conventions and recovery

Files under `~/.omp/agent/` (`AGENTS.md`, `extensions/superpowers-bootstrap.ts`, `lsp.json`, managed keys in `config.yml`) are owned by `glockyco/omp-agent-setup`. Don't edit the deployed copies directly. Change the source in `~/Projects/omp-agent-setup/` and run `bun run bootstrap` (`bun run doctor` for a health check, `bun run verify` for the full gate). Don't add repo-local plugin copies unless a repo needs a genuine override.

If Superpowers seems inactive, verify `skill://using-superpowers` resolves and the bootstrap extension is loaded (check OMP logs). If Plannotator seems inactive, verify `~/Projects/plannotator/apps/pi-extension/` is built.
