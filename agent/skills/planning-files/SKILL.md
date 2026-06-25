---
name: planning-files
description: Conventions and tooling for planning docs in docs/plans/ (front-matter, status lifecycle, INDEX.md, the omp-plans CLI). Use when creating, resuming, or finishing a plan or spec; checking what work is active or stale across sessions; validating planning docs; or working anywhere under docs/plans/.
---

# Planning Files

Every repo's plans and specs live in `docs/plans/` with a uniform front-matter
header, a generated `INDEX.md`, and the `omp-plans` CLI for indexing, validation,
and status. Plans are forward-looking: progress is the checkbox state and history
lives in git — never an in-file changelog.

## Location

- Planning artifacts: `docs/plans/<YYYY-MM-DD>-<kebab-topic>.md`; retired docs: `docs/plans/archive/`.
- The same path in every repo (not overridable). A planless repo is fine; the moment you write the first plan, it goes here.
- Genuine reference docs (env setup, architecture notes) stay elsewhere under `docs/`.

## Front-matter (every doc)

```yaml
---
title: Short Title
type: spec          # spec | plan | prd | audit | note
status: active      # draft | active | implemented | superseded | abandoned
created: 2026-06-23
parent:             # umbrella doc slug (same repo), if any
superseded_by:      # successor slug; required when status: superseded
archived:           # YYYY-MM-DD; set when moved to archive/
---
```

Store only stable facts. Last-touched is derived from git and completion from
checkboxes — never hand-maintain them. A slug is the filename without `.md`;
`parent`/`superseded_by` resolve within the same repo (cross-repo references go in prose).

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

## Tooling — `omp-plans`

Runs from any repo, CWD-scoped onto `./docs/plans/`; no-ops when that directory is absent.

- `omp-plans status [--active|--stale|--complete|--archive] [--json] [--fleet]` — what is active, stale, or done; `--fleet` sweeps `~/Projects`.
- `omp-plans index` — regenerate `docs/plans/INDEX.md` (the only command that writes).
- `omp-plans check` — validate front-matter, filename format, `parent`/`superseded_by` link integrity, and index freshness (non-zero exit; wire into pre-commit/CI).

Run `omp-plans --help` for exact flags. Retention thresholds (`stale_days`,
`archive_delete_days`) default in the tool and may be overridden per repo in
`docs/plans/plans.toml`. The tool only reports; it never deletes or moves docs.

## Workflow

1. Read `docs/plans/INDEX.md` first; `omp-plans status --active` for current state across sessions.
2. Resume from the plan's unchecked tasks (`git log -- <doc>` for past context).
3. Implement; check boxes in the same commit; adapt the plan if it drifts.
4. On completion: `omp-plans check`, set `status: implemented`, move to `archive/`, then `omp-plans index`.
