---
title: Planning-Convention Fan-Out to Fleet Repos
type: plan
status: implemented
created: 2026-06-25
parent: 2026-06-23-planning-file-conventions-design
superseded_by:
archived: 2026-06-25
---

# Planning-Convention Fan-Out to Fleet Repos

Phase 3 (opt-in fan-out) of the planning-file conventions rollout: adopt
`docs/plans/` + front-matter + a generated `INDEX.md` + `omp-plans`
validation in the remaining actively-maintained repos. Every legacy doc was
classified against the live codebase (shipped routes/mods/tooling), not by its
stale checkbox state — a doc is `active` only while its work is unbuilt; once it
ships it archives as `implemented` (or `superseded`/`abandoned`).

## Outcome by repo

- **HotRepl** — 22 docs from `docs/superpowers/{plans,specs}`; all archived
  (shipped, dormant tool; v1 control-plane superseded by the v2 clean
  architecture). dprint excludes `docs/plans` (it would reflow prose and fight
  the generated INDEX); `omp-plans index/check` wired into pre-commit.
- **ancient-kingdoms-mods** — 27 docs (incl. a `research/` note); 6 active,
  18 implemented, 3 abandoned (incl. `bestiary-revealer`, superseded by the
  shipped BetterBestiary mod, which has no doc to link). No repo-root formatter
  touches `docs/`, so only the hook was wired.
- **ardenfall-compendium** — 32 docs (incl. an `audits/` cluster and the living
  roadmap); 3 active (Slice 7 data-architecture spec + entity-placement plan +
  roadmap), 29 archived. The roadmap's same-repo references were re-pointed to
  the new paths. prettier excludes `docs/plans`; hook wired. The roadmap's
  "delete completed plans" prose still diverges from this convention's
  archive/ retention and is left for the owner to reconcile.
- **personal-website** — the root `PLAN.md` became an active plan; hook wired.
- **Erenshor (erenshor-data-mining)** — already adopted in the cross-repo
  migration (44 docs); no change.
- **superpowers** — skipped: an upstream fork, not ours to restructure.

## Tasks

- [x] HotRepl: classify, migrate, exclude from dprint, wire hook
- [x] ancient-kingdoms-mods: classify, migrate, wire hook
- [x] ardenfall-compendium: classify, migrate, re-point roadmap, exclude from
      prettier, wire hook
- [x] personal-website: migrate PLAN.md, wire hook
- [x] Confirm Erenshor already adopted; skip superpowers (fork)
