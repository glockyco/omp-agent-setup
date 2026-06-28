---
name: planning-docs
description: Conventions for editing planning docs under docs/plans/ (full skill: planning-files)
condition:
  - docs/plans/**
---
You are editing a planning doc under `docs/plans/`. Follow `skill://planning-files`:

- **One concern per doc**; pick the right `type` — `overview` (north-star), `spec` (design), `plan` (checkbox tasks), `audit` (point-in-time findings), `note` (short scratch).
- **Forward-looking only**: no `[corrected]`, no dated changelog, no "supersedes the above". Edit to the current truth and delete the old; git holds the history. (`audit` docs may carry a date, but keep them current — refresh or archive a stale audit instead of leaving outdated findings active.)
- Set front-matter (`title`/`type`/`status`/`created`) and `parent` (the repo's `overview`).
- After adding, renaming, or archiving a doc, run `omp-plans index`, then `omp-plans check` before committing.
