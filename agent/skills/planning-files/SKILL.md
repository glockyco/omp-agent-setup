---
name: planning-files
description: Conventions and tooling for planning docs in docs/plans/ (front-matter, status lifecycle, INDEX.md, the omp-plans CLI). Use when creating, resuming, or finishing a plan or spec; checking what work is active or stale across sessions; validating planning docs; or working anywhere under docs/plans/.
---

# Planning Files

Every repo's plans and specs live in `docs/plans/` with a uniform front-matter
header, a generated `INDEX.md`, and the `omp-plans` CLI for indexing, validation,
and status. Forward-looking docs (`overview`/`spec`/`plan`/`note`) describe the
desired state now; history lives in git, never in the body. The `audit` type is the
one exception — it records findings at a point in time (see Document types).

## Location

- Planning artifacts: `docs/plans/<YYYY-MM-DD>-<kebab-topic>.md`; retired docs: `docs/plans/archive/`.
- The same path in every repo (not overridable). A planless repo is fine; the moment you write the first plan, it goes here.
- Genuine reference docs (env setup, architecture notes) stay elsewhere under `docs/`.

## Front-matter (every doc)

```yaml
---
title: Short Title
type: spec          # overview | spec | plan | audit | note
status: active      # draft | active | implemented | superseded | abandoned
created: 2026-06-23
parent:             # umbrella doc slug (same repo), if any
superseded_by:      # successor slug; required when status: superseded
archived:           # YYYY-MM-DD; set when moved to archive/
---
```

Store only stable facts. Last-touched is derived from git for `status` reports,
and completion from checkboxes — never hand-maintain them. `INDEX.md` is stable
navigation, not a freshness report. A slug is the filename without `.md`;
`parent`/`superseded_by` resolve within the same repo (cross-repo references go in prose).

## Document types

Pick by what the reader needs. Each doc is exactly one type, and that choice fixes
what it holds and what belongs elsewhere — mixing types is the top cause of doc
sprawl.

| type | reader need | holds exactly one… | never holds (→ where it goes) |
|---|---|---|---|
| `overview` | "where do I start?" | project north-star: goal, strategy sequence, map of children, current focus | evidence / tasks / provenance (→ audit / plan / spec) |
| `spec` | "what are we building & why?" | design + acceptance for one change, before building | ordered build steps (→ plan); findings (→ audit) |
| `plan` | "what's the ordered work; am I done?" | the checkbox-tracked task sequence for one deliverable | strategy (→ overview); findings (→ audit) |
| `audit` | "what did we find / decide, as of when?" | one investigation's point-in-time evidence or decision (ADR-style) | forward-looking tasks (→ plan) |
| `note` | a short-lived scratch / backlog / pointer | one small, ephemeral concern | tables, phases, or provenance — graduate it to audit / spec / plan |

**One concern per doc.** State it in the first line. The moment a doc needs a
section belonging to another type — a plan growing an evidence table, a note growing
phases — split it and cross-reference by slug. A broad title ("roadmap", "coverage &
improvements", "scratchpad") is the smell of a doc about to sprawl; name docs by the
one concern they own.

## The overview doc

A repo with more than ~2 active docs SHOULD have exactly one `overview` — the
steering / north-star file, the first thing an agent reads after `INDEX.md`. It holds
the goal, the strategy sequence, a slug-linked map of the children, and a pointer to
the current focus; it inlines no evidence, tasks, or provenance, so it stays compact
(≤~150 lines) and rarely goes stale (a stale root poisons every agent's context).
Every other doc sets `parent:` to the overview (or a nearer umbrella), so `INDEX.md`
renders the tree. The repo's `AGENTS.md` / `CLAUDE.md` MUST link `docs/plans/INDEX.md`
and the overview, so a fresh agent reaches the tree without searching.

## When a change needs a doc

Not every change needs a planning doc — match the artifact to the change:

| change | artifact |
|---|---|
| small, isolated, reversible (a few files, no downstream callers) | none — the commit message is the record |
| one cohesive feature/fix with real design choices | one `spec` or `plan` |
| spans subsystems, has callers that break, is long-lived, or is hard to reverse | `spec` (+ `plan`) and human sign-off |

Write the doc the moment an ad-hoc change starts to span multiple files/systems,
gain callers, grow non-local effects (build/security/data), or outlive the session —
the classic trap is a "quick fix" that quietly becomes permanent. When scope grows
mid-implementation, stop and write it down rather than pressing on from memory.

## Status lifecycle

`draft` → designing/reviewing · `active` → approved, in progress · `implemented` →
all tasks shipped · `superseded` → replaced · `abandoned` → dropped. Update the
header **in the same commit** as the change it reflects. Move retired docs to
`archive/` with `archived:` set; once archived they are immutable except
typo/link fixes.

## Progress & drift (living docs, no history)

- Plans decompose into `- [ ]` / `- [x]` tasks under a `## Tasks` section or `### Task N` headings; check boxes in the same commit as the work. Checkboxes elsewhere or inside fenced code do not count toward completion.
- When implementation diverges from the plan, adapt the plan text in the same commit so it matches reality. What changed and why goes in the commit message — there is no in-file progress log.
- Tick boxes as you go (one commit per step or phase), not in a bulk pass at the end. Don't retro-tick an already-`implemented` or freshly-migrated plan — `status` is authoritative there, and completion only matters for `active` plans.

## Write the desired state, not its history

A forward-looking doc reads as if it had always said what it says now. The diff and
the commit message carry the history; the body never narrates its own revisions.
Never write, in a doc body:
- correction / revision markers — `[corrected]`, `revised after feedback`, `update:`,
  `(was: …)`, `previously`, `I was wrong`, `now we think`;
- in-body changelogs or dated entries — `## 2026-06-26 — supersedes the above`;
- supersede-in-place — keeping an old section beside "this supersedes it." Delete the
  old text; git holds it.

When understanding changes, edit the text to the new truth and delete the old in the
same commit; what changed and why goes in the commit message. The only sanctioned
progress signal is checkbox state; the only sanctioned dates are the front-matter
`created` / `archived` fields. The `audit` type is the exception — it is a
point-in-time record, so a date in its title or body is correct — but it is still
never edited into a changelog; supersede it with a new audit.

## Tooling — `omp-plans`

Runs from any repo, CWD-scoped onto `./docs/plans/`; no-ops when that directory is absent.

- `omp-plans status [--active|--stale|--complete|--archive] [--json] [--fleet]` — what is active, stale, or done, including git-derived freshness; `--fleet` sweeps `~/Projects`.
- `omp-plans index` — regenerate the stable navigation file `docs/plans/INDEX.md`.
- `omp-plans check` — validate front-matter, filename format, `parent`/`superseded_by` link integrity, and that `INDEX.md` matches generated navigation (non-zero exit; wire into pre-commit/CI).
- `omp-plans complete <slug>` — mark one active doc `implemented`, set `archived:` to today, move it to `docs/plans/archive/`, regenerate `INDEX.md`, and run `check`.
Run `omp-plans --help` for exact flags. Retention thresholds (`stale_days`,
`archive_delete_days`) default in the tool and may be overridden per repo in
`docs/plans/plans.toml`. The tool only moves docs when explicitly asked with `complete <slug>`.

## Workflow

1. Read `docs/plans/INDEX.md` first; `omp-plans status --active` for current state across sessions.
2. Resume from the plan's unchecked tasks (`git log -- <doc>` for past context).
3. Implement; check boxes in the same commit; adapt the plan if it drifts.
4. On completion: run `omp-plans complete <slug>` for the implemented plan/spec before the final response. If completing manually, set `status: implemented`, set `archived: YYYY-MM-DD`, move the file to `archive/`, rerun `omp-plans index`, and rerun `omp-plans check`.
