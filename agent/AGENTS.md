# Global OMP agent guidance

Loaded by every oh-my-pi (`omp`) session. Source-of-truth: `glockyco/omp-agent-setup/agent/AGENTS.md`. Edit there, not the deployed symlink.

## Harness

Primary harness is [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`). Don't assume regular Pi behavior unless verified against OMP. Prefer `.omp` paths over `.pi`, and `AGENTS.md` over `CLAUDE.md`.

## Methodology

Methodology is [Superpowers](https://github.com/glockyco/superpowers/tree/omp-local) at `~/Projects/superpowers`. Plan/review UI is [Plannotator](https://github.com/glockyco/plannotator/tree/omp-local) at `~/Projects/plannotator`. Skills load via OMP's `skills.customDirectories`. The `using-superpowers` skill is injected at session start by the `superpowers-bootstrap` extension. User instructions always override Superpowers skills, and the user may opt out of Superpowers for tiny tasks.

## Editor surface: Zed (ACP)

OMP runs inside Zed via the [Agent Client Protocol](https://github.com/zed-industries/agent-client-protocol) (`omp acp`). When invoked from Zed's Agent panel, tool I/O routes through the editor: `read`/`write` go through Zed's buffer and save pipeline (so unsaved changes are visible to OMP, and writes hit Zed's formatter and undo history), `bash` calls render as Zed terminals, and destructive tools (`edit`, `ast_edit`, `write`, `bash`) gate via `session/request_permission` with an "allow always" option. LSP, DAP, and subagent fan-out stay inside OMP; ACP only bridges the editor-visible surface, so the agent and the IDE can independently disagree on, e.g., C# analyzer diagnostics (csharp-ls defaults `analyzersEnabled: false`).

The agent server is registered in `~/.config/zed/settings.json` under `agent_servers["omp-acp"]` by `omp-agent-setup`'s `bun run bootstrap`. C# LSP is intentionally split: Zed uses Roslyn (its default) for interactive editing; OMP uses csharp-ls for headless tool calls. Don't force parity.

## Conventions and recovery

Files under `~/.omp/agent/` (`AGENTS.md`, `extensions/superpowers-bootstrap.ts`, `lsp.json`, `skills/{commit,writing-project-readmes,writing-agent-instructions,writing-omp-skills}/`, managed keys in `config.yml`) and the managed `agent_servers["omp-acp"]` entry in `~/.config/zed/settings.json` are owned by `glockyco/omp-agent-setup`. Don't edit the deployed copies directly. Change the source in `~/Projects/omp-agent-setup/` and run `bun run bootstrap` (`bun run doctor` for a health check, `bun run verify` for the full gate). Commit guidance lives in `skill://commit`; documentation guidance lives in `skill://writing-project-readmes`, `skill://writing-agent-instructions`, and `skill://writing-omp-skills`. Don't add repo-local plugin or skill copies unless a repo needs a genuine override.

If Superpowers seems inactive, verify `skill://using-superpowers` resolves and the bootstrap extension is loaded (check OMP logs). If Plannotator seems inactive, verify `~/Projects/plannotator/apps/pi-extension/` is built.
