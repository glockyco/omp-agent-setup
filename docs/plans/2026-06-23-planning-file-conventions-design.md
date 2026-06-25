---
title: Planning-File Conventions & Tooling (cross-repo)
type: spec
status: active
created: 2026-06-23
parent:
---

# Planning-File Conventions & Tooling — Design

A thin **structure + tooling** layer over Superpowers, deployed **globally via
`omp-agent-setup`** (the existing dotfiles-for-agents hub) and consumed by every
repo. Superpowers supplies the *workflow* (brainstorm → spec → plan → execute)
and works well; what is missing is where artifacts live, how they are named, how
their lifecycle/status is legible across sessions and agents, and tooling to
query and validate the collection — uniformly across all repos. No external spec
framework is imported; only proven *patterns* (ADR lifecycle/index, markdown task
systems, git-derived freshness) are borrowed.

## Problem

- **Erenshor audit (2026-06-23):** 44 docs across three locations (`docs/plans/` 28, `docs/superpowers/plans/` 4, `docs/superpowers/specs/` 7) + 5 loose; three conflicting location conventions (AGENTS.md vs `writing-plans` vs `brainstorming` defaults); 9 untracked docs; no machine-readable status; no index; two undated filenames; a broken supersede link.
- **Fleet-wide:** the siblings have already informally converged on `docs/plans/` (ancient-kingdoms-mods 27, HotRepl 22, ardenfall-compendium 27, omp-agent-setup 6, Erenshor 40) — same drift, no shared convention or tooling. The fix should be consistent across repos, not re-solved per repo.

## Architecture: global vs per-repo

The planning **workflow** is a global surface of `omp-agent-setup`; only the
**plan docs themselves** are per-repo. Grounded in omp-agent-setup's existing
model (Bun CLI, symlink bootstrap, `doctor`/`verify` gates, `backups/` rollback)
and its `audit-lsp` precedent (a repo-agnostic fleet tool with global-default +
per-repo-override config).

| Concern | Home |
|---|---|
| `planning-files` skill (generic convention) | **Global** — `omp-agent-setup/agent/skills/planning-files/SKILL.md`; one-line register in `src/managed-skills.ts` (`LOCAL_MANAGED_SKILLS`) → auto-symlinked to `~/.omp/agent/skills/`, resolves as `skill://planning-files` everywhere, gated by `doctor`/`verify`. |
| docs/plans **location** convention (override #1) | **Global** — a one-line block in `omp-agent-setup/agent/AGENTS.md` + a Skill-Directory pointer. |
| Tooling `omp-plans {index,check,status}` | **Global** — Bun/TS CLI in omp-agent-setup, PATH bin, `--fleet` subcommand. |
| Threshold config | **Global defaults** baked into the tool + **per-repo override** `docs/plans/plans.toml`. |
| **no-worktrees** preference (override #2) | **Per-repo** — Erenshor's AGENTS.md only (NOT global: HotRepl uses `.worktrees/`). |
| The plan docs, `docs/plans/archive/`, generated `INDEX.md`, hook wiring | **Per-repo** — each repo's own artifacts. |
| Erenshor's one-time 44-doc migration | **Per-repo** — Erenshor only. |

## Convention (repo-agnostic)

### 1. Location (canonical, consistent across repos)
Planning artifacts live in `docs/plans/` (with `docs/plans/archive/` for retired
docs) — the **same path in every repo; not per-repo overridable** (consistency is
the point). Adoption is the only flexibility: a **planless repo is fine** and the
tooling no-ops when `docs/plans/` is absent, but the moment the first planning doc
is created it lives at `docs/plans/`. Genuine reference docs (e.g. an env-setup
guide) stay elsewhere in `docs/`.

### 2. Front-matter (every doc) — store *stable* facts only
```yaml
---
title: Wiki Cargo Phase 3
type: plan          # spec | plan | prd | audit | note
status: active      # draft | active | implemented | superseded | abandoned
created: 2026-06-23
parent: 2026-06-04-wiki-cargo-data-architecture   # umbrella slug, if any
superseded_by:      # successor slug; required when status: superseded
archived:           # YYYY-MM-DD set when moved to archive/; immutable after
---
```
`type` carries the spec↔plan distinction (metadata, **not folders**). Volatile
facts are NOT stored: *last-touched* derives from git for `status` reports,
*completion %* from checkboxes, and `INDEX.md` stays stable navigation rather than
a freshness report — storing volatile facts invites drift.

### 3. Status lifecycle
`draft` → being designed/reviewed · `active` → approved, in progress · `implemented` → all tasks shipped · `superseded` → replaced (`superseded_by` set; successor links back via `parent`) · `abandoned` → dropped. Update the header **in the same commit** as the change. Retired docs move to `archive/` with `archived:` set and become immutable (typo/link fixes only). **Completion** = a `plan` whose task checkboxes are all checked — a heuristic the tool flags for confirmation, never an auto-transition.

### 4. Task status (living docs, no in-file history)
- Plans decompose into `- [ ]` / `- [x]` checkboxes (the `writing-plans` format); checkboxes are the single source of truth for progress, checked **in the same commit** as the work.
- **Scoped counting:** only checkboxes under a `## Tasks` section (or `### Task N` blocks) count toward completion; fenced-code and illustrative/nested checklists are ignored.
- **Drift rule:** when implementation diverges, adapt the doc **in the same commit** so it matches reality; the narrative of what changed and why lives in the commit message — **no in-file progress log or changelog**.

### 5. Naming
`YYYY-MM-DD-kebab-topic.md`; optional `-design` suffix for specs (`type` is authoritative).

## Tooling — `omp-plans` (global Bun CLI in omp-agent-setup)

Built in omp-agent-setup as `src/plans.ts` (pure: front-matter parse, scoped
checkbox count, classify) + `src/plans-runtime.ts` (real fs/git), mirroring the
`lsp-audit.ts`/`-runtime.ts` split, unit-tested with injected fs/git. **Bun/TS,
not Python:** Bun is the only runtime guaranteed wherever omp-agent-setup is
bootstrapped (the `omp` bin runs on Bun); only 1 of 6 target repos has Python;
zero new deps (`yaml` already present, git already shelled). Exposed as a managed
PATH bin `omp-plans` (symlinked + `doctor`/`verify`-gated like the `omp` bin) and
reachable as an omp-agent-setup subcommand for fleet runs.

CWD-scoped onto `./docs/plans/`; **only `index` mutates** (writes `INDEX.md`):
- **`omp-plans index`** — regenerate `./docs/plans/INDEX.md` (build artifact; active/draft grouped by status; rows show title, type, slug, completion, parent; `archive/` excluded with one trailing link). Git-derived freshness is deliberately excluded so an index generated before a doc's first commit remains valid after that commit.
- **`omp-plans check`** — validate front-matter schema/values, filename format, `parent`/`superseded_by` link integrity, and whether `INDEX.md` matches generated navigation; non-zero for hooks/CI; **no-op when `docs/plans/` absent**.
- **`omp-plans status [--active|--stale|--complete|--archive] [--json] [--fleet]`** — read-only query. Per doc: status, type, completion (checkboxes), last-touched (git, with `[docs-skip]` commit filter), archive age. `--fleet` reuses `discoverRepos` to sweep `~/Projects` (active/warm/dormant filtering); `--json` for agent consumption.

**Config:** defaults baked in (like `DEFAULT_ACTIVITY`); per-repo override at
`docs/plans/plans.toml` for **thresholds only** (`stale_days`, `archive_delete_days`)
— **not** the path; merged defaults ← override, the same pattern as `lsp-audit`'s
global+per-project merge.
**Retention is report-only:** stale-active and old-archived docs are flagged as
candidates; deletion/move is always a human/agent decision.

## Overrides of Superpowers defaults
- **#1 Location (global, consistent):** planning artifacts live in `docs/plans/` in every repo, overriding the `docs/superpowers/{specs,plans}/` defaults of brainstorming/writing-plans. **Not per-repo overridable**; adoption is opt-in only (planless repos are fine until the first plan). Lives in `omp-agent-setup/agent/AGENTS.md`.
- **#2 Inline execution / no worktrees (per-repo):** implement plans inline in the main working tree, no git worktrees. **Not global** — HotRepl uses worktrees. Lives in Erenshor's AGENTS.md.

## Discoverability & carrier
How an agent learns the CLI exists and when to use it. **Layered, skill-primary, no MCP** — content placed by each surface's always-on cost and volatility.
- **Primary: `skill://planning-files`** (global, generic). Its **trigger-rich `description`** is the always-on breadcrumb (~1 line in the system prompt every session; omp's `using-superpowers` nudge amplifies it) and must enumerate concrete situations (start/resume/finish a plan, check active/stale, validate, anything under `docs/plans/`) — a vague description is the main reason a skill fails to fire. The **body** (on-demand) carries the full convention + workflow and says to run `omp-plans` via bash; it references `omp-plans --help` for flags rather than listing them, so it can't go stale.
- **Always-on breadcrumb: a ~3-line block in global `agent/AGENTS.md`** — earns its place by stating the `docs/plans/` convention (a real override), the single highest-value action, and the skill pointer: *"Planning artifacts live in `docs/plans/` (same in every repo; planless repos are fine until the first plan). Before resuming multi-session work, run `omp-plans status`; `omp-plans index`/`check` maintain `INDEX.md` navigation and validate front-matter. Full convention: `skill://planning-files`."* Per-repo `AGENTS.md` carries only deltas.
- **Flag surface: `omp-plans --help`** — volatile detail (subcommands, flags, exit codes, `plans.toml` keys) lives in code, reached on demand, never duplicated into the skill.
- **No MCP.** `omp-plans` is local, stateless, and shell-invocable; the bash tool already runs it. An MCP server would add permanent tool-schema context to **every session and every subagent in every repo** (even when no planning happens), a per-session daemon/process lifecycle, and a second interface to keep synced with the bin that lefthook/CI need regardless — for zero capability gain (`--json` already gives structured output). Matches the `audit-lsp` precedent (plain CLI). MCP's bar — stateful / networked / authenticated / non-shell — is not met.
- **Not `RULES.md`** — it re-attaches every turn; most turns aren't planning and planless repos exist. The opening-context `AGENTS.md` block is the correct, cheaper home.
- **Slash command (optional, human-only):** a `/plans` command wrapping `omp-plans status --fleet` is a user convenience, invisible to the model — **not** an agent-discovery mechanism.
- **Enforcement ≠ discovery:** the lefthook `omp-plans check` gate makes validation deterministic regardless of whether an agent loaded the skill — discovery carries the read/status/workflow path; the hook carries enforcement.

## Agent workflow (documented in the skill)
1. Read `INDEX.md` first; `omp-plans status --active` for current state across sessions.
2. Resume from unchecked tasks (`git log -- <doc>` for past context).
3. Implement; check boxes **in the same commit**; if drifting, adapt the plan text (the why goes in the commit message).
4. On completion: `omp-plans check`, mark `implemented`, move to `archive/` (set `archived:`), regenerate `INDEX.md`.

## Rollout (two plans, two repos)
1. **omp-agent-setup:** build `omp-plans` (`plans.ts` + `plans-runtime.ts`, `index`/`check`/`status` + `--fleet`); unit-test the pure core. Register `planning-files` in `LOCAL_MANAGED_SKILLS` + write the generic skill; add the managed `omp-plans` bin + `doctor`/`verify` checks; add the location block to `agent/AGENTS.md`. Relocate this design spec into `omp-agent-setup/docs/plans/` (authoritative copy lives with the feature). `bun run bootstrap` → `doctor`/`verify`.
2. **Erenshor (pilot — messiest corpus):** adopt the convention; run the one-time migration with `omp-plans` (front-matter backfill + verified status; consolidate `docs/superpowers/{plans,specs}/` + loose PRDs into `docs/plans/`; archive the 2026-04 Adventure Guide cluster; fix the broken nav-stall supersede link; rename two undated files; commit the 9 untracked); **delete the `erenshor docs` Typer stub** (`main.py:566-591`); add the per-repo no-worktrees override + `docs/plans/plans.toml`; wire `omp-plans check` into lefthook.
3. **Fan out (opt-in):** other repos that plan (HotRepl, ardenfall-compendium, personal-website, ancient-kingdoms-mods if desired) — create/backfill `docs/plans/`, wire the hook. Skip dormant/non-software dirs.

## Decisions resolved
- Centralize in omp-agent-setup; per-repo only for docs + Erenshor migration + no-worktrees override.
- Tooling = **Bun/TS `omp-plans`** (clean cutover; delete the Erenshor Typer stub, no alias).
- Location is the **consistent canonical `docs/plans/`** in every repo (not per-repo overridable); adoption is opt-in — planless repos are fine until the first plan.
- Thresholds: global defaults + `docs/plans/plans.toml` per-repo override.
- Progress = checkbox state (current status, not history); drift adapts the plan in the same commit; history lives in git.
- Convention in a **global generic** `planning-files` skill; AGENTS.md carries only the location override + pointer (global) and no-worktrees (Erenshor).
- Discovery = skill-primary (trigger-rich description) + ~3-line global AGENTS breadcrumb + `--help`; **no MCP, no RULES.md**; slash command optional/human-only; lefthook `check` is the enforcement backstop.

## Prior art & best practices (sources)
- **Dotfiles-for-agents** (central source + symlink bootstrap, "change once, affect everywhere") and layered global/per-repo config: [dotfiles+agents](https://sionwilliams.com/posts/2026-03-13-dotfiles-agentic-workflows/), [Basis monorepo layering](https://www.getbasis.ai/blogs/how-we-made-our-monorepo-ergonomic-for-agents), [centralized config](https://docs.terrateam.io/advanced-workflows/centralized-configuration/).
- **ADR tooling** — generated index as a build artifact, status lifecycle, supersede links, immutability: [adr.github.io](https://adr.github.io/adr-tooling/), [pyadr](https://github.com/opinionated-digital-center/pyadr).
- **Markdown task systems / git freshness** — checkboxes as source of truth, derive last-modified from git: [taskmd](https://medium.com/@driangle/taskmd-task-management-for-the-ai-era-92d8b476e24e), [git file modified time](https://jeffkreeftmeijer.com/git-file-modified-time/).
- **AGENTS.md** lean/link-don't-inline (`writing-agent-instructions`); **skills** project-agnostic, 50–100 lines (`writing-skills`).
- **omp-agent-setup grounding:** `audit-lsp` fleet tool + global/per-repo override (`src/lsp-audit*.ts`, README §LSP), managed-skills one-line registration (`src/managed-skills.ts`), bin symlink + `doctor`/`verify` + `backups/` (`src/bin-link*.ts`, `src/bootstrap.ts`, `src/cli.ts`).
