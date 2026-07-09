---
title: Remove Superpowers From Managed OMP Setup
type: plan
status: active
created: 2026-07-09
parent:
superseded_by:
archived:
---

# Remove Superpowers From Managed OMP Setup

Goal: remove Superpowers as a managed plugin, skill source, required workflow, and prompt-injection layer while preserving the OMP session environment contract used by Plannotator and local tools.

Architecture: replace the Superpowers bootstrap extension with an OMP-owned session-env extension, remove Superpowers from managed config and verification gates, and update managed docs/skills to point at OMP-native workflow plus living primary sources. Keep the cut clean: no legacy aliases, compatibility shims, or hidden Superpowers fallback paths.

## Acceptance

- `bun run bootstrap` deploys `extensions/omp-session-env.ts` and no longer deploys `extensions/superpowers-bootstrap.ts`.
- Managed config keeps Plannotator extension/skills and removes `~/Projects/superpowers/skills`.
- `bun run verify` no longer requires `using-superpowers` or `brainstorming`, and no longer runs or documents a Superpowers acceptance smoke.
- `bun run doctor` checks the new session-env extension name.
- `bun run update-superpowers` is gone; `manifests/plugins.yml` owns only active plugins.
- `agent/AGENTS.md`, root `AGENTS.md`, and `README.md` describe OMP-native workflow and no Superpowers dependency.
- `writing-agent-instructions` and `writing-project-readmes` are rewritten as concise OMP-local guidance that references living sources for generic best practices.
- Tests cover the cutover and pass with no Superpowers files or skills present.

## Tasks

- [ ] Split and rename the session environment extension
  - Rename `extensions/superpowers-bootstrap.ts` to `extensions/omp-session-env.ts`.
  - Delete prompt injection, `using-superpowers` loading, Superpowers root resolution, markers, and bootstrap assembly.
  - Keep `installSessionEnvVars`, `OMP_AGENT_DIR` seeding, and `session_start` registration.
  - Rename tests from `tests/superpowers-bootstrap.test.ts` to `tests/omp-session-env.test.ts` and assert no `before_agent_start` handler is registered.

- [ ] Remove Superpowers from managed runtime surfaces
  - Update `src/config.ts` and `config/config.yml.template` to use `~/.omp/agent/extensions/omp-session-env.ts` and remove `~/Projects/superpowers/skills`.
  - Update `src/bootstrap.ts` to snapshot/link `omp-session-env.ts` only.
  - Update `src/cli.ts` to remove `using-superpowers`, `brainstorming`, the Superpowers skill directory, the acceptance smoke, `update-superpowers`, and old doctor labels.
  - Update `package.json`, `knip.json`, and `manifests/plugins.yml` to remove Superpowers ownership.

- [ ] Update deployment and command tests
  - Adjust CLI/config/bootstrap/integration/plugin tests to expect the new extension, no Superpowers plugin, no Superpowers-required skills, and no removed script.
  - Add or adapt a test that fails if the session-env extension registers `before_agent_start`.
  - Keep plugin parsing generic; remove Superpowers-specific fixtures where Plannotator-only fixtures prove the same behavior.

- [ ] Rewrite managed docs and local writing skills
  - Rewrite `agent/AGENTS.md` methodology around OMP-native workflow, `/plan`, `docs/plans/`, task subagents, Plannotator, and living OMP docs.
  - Update root `AGENTS.md` and `README.md` commands, plugin tables, boundaries, and env contract names.
  - Rewrite `agent/skills/writing-agent-instructions/SKILL.md` as OMP-local instruction-file maintenance guidance with links to AGENTS.md, OpenAI Codex AGENTS, Codex Skills, Agent Skills spec, Anthropic Skills, and OMP docs.
  - Rewrite `agent/skills/writing-project-readmes/SKILL.md` as concise README maintenance guidance that requires source-backed commands and current research for generic README best practices.

- [ ] Verify and archive the plan
  - Run targeted tests for changed areas.
  - Run `bun run check:types`, `bun run check:lint`, `bun run check:dead`, and `bun run check:test`.
  - Run `bun run verify` if available after the cutover; otherwise run the documented non-live substitute and record the limitation.
  - Run `omp-plans complete 2026-07-09-remove-superpowers-from-managed-omp-setup` after implementation passes.
