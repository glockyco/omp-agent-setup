---
title: Cross-Repo Planning Docs Migration
type: plan
status: active
created: 2026-06-25
parent: 2026-06-23-planning-file-conventions-design
---

# Cross-Repo Planning Docs Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `skill://executing-plans` for inline execution unless the user explicitly requests subagents. Steps use checkbox (`- [ ]`) syntax for tracking. Use `skill://planning-files` before editing any plan file.

**Goal:** Normalize every current planning artifact in the active Teralizer/thesis/OMP repos into the shared `docs/plans/` convention, without dropping ignored or untracked notes merely because they were not previously committed.

**Architecture:** `omp-agent-setup` owns the global convention and this cross-repo rollout plan. Each target repo gets its own `docs/plans/` directory, generated `INDEX.md`, and `omp-plans check` verification. Existing documents move into `docs/plans/` or `docs/plans/archive/` with front matter; old locations are removed only after their content has a normalized destination.

**Tech Stack:** Markdown planning docs, YAML front matter, `omp-plans index/check/status`, git history for freshness, existing `skill://planning-files` convention.

**Inclusion rule:** Migrate every planning artifact found in legacy locations (`docs/superpowers/**`, `.claude/plans/**`, `plans/**`, `plans/specs/**`) unless it contains secrets/confidential material, is generated output, or is an exact duplicate of a migrated doc. Untracked/ignored status is not a reason to exclude a document. If a document is obsolete, migrate it to `docs/plans/archive/` with `status: implemented`, `superseded`, or `abandoned` rather than silently deleting it.

---

## Tasks

### Task 1: Refresh `omp-agent-setup` planning index

**Files:**
- Create: `/Users/joaichberger/Projects/omp-agent-setup/docs/plans/2026-06-25-cross-repo-planning-docs-migration.md`
- Modify: `/Users/joaichberger/Projects/omp-agent-setup/docs/plans/INDEX.md`

- [x] **Step 1 — Regenerate the index.**

Run:

```bash
cd /Users/joaichberger/Projects/omp-agent-setup
omp-plans index
```

Expected: `docs/plans/INDEX.md` lists `2026-06-25-cross-repo-planning-docs-migration` under `active`.

- [x] **Step 2 — Validate the repo planning set.**

Run:

```bash
cd /Users/joaichberger/Projects/omp-agent-setup
omp-plans check
```

Expected: `ok (...)` with no stale-index error.

- [x] **Step 3 — Commit the rollout plan and index.**

Run:

```bash
cd /Users/joaichberger/Projects/omp-agent-setup
git add docs/plans/2026-06-25-cross-repo-planning-docs-migration.md docs/plans/INDEX.md
git commit -m "docs(plans): plan cross-repo planning-doc migration"
```

Expected: a commit containing only this plan and the regenerated index.

---

### Task 2: Migrate legacy `omp-agent-setup` planning artifacts

**Files:**
- Move from `docs/superpowers/**` to `docs/plans/archive/`:
  - `docs/superpowers/2026-05-16-doc-audit.md`
  - `docs/superpowers/plans/2026-05-15-documentation-skills-implementation.md`
  - `docs/superpowers/plans/2026-05-16-zed-integration-and-lsp-hygiene.md`
  - `docs/superpowers/plans/2026-05-26-hindsight-codex-local-integration.md`
  - `docs/superpowers/specs/2026-05-15-documentation-skills-design.md`
  - `docs/superpowers/specs/2026-05-16-acp-supported-features-implementation-spec.md`
  - `docs/superpowers/specs/2026-05-26-hindsight-codex-local-integration-design.md`
- Modify: `docs/plans/INDEX.md`

- [x] **Step 1 — Move and classify the setup docs.**

Use these target paths and front-matter values:

| Source | Target | type | status | parent | superseded_by |
|---|---|---|---|---|---|
| `docs/superpowers/specs/2026-05-15-documentation-skills-design.md` | `docs/plans/archive/2026-05-15-documentation-skills-design.md` | `spec` | `implemented` | empty | empty |
| `docs/superpowers/plans/2026-05-15-documentation-skills-implementation.md` | `docs/plans/archive/2026-05-15-documentation-skills-implementation.md` | `plan` | `implemented` | `2026-05-15-documentation-skills-design` | empty |
| `docs/superpowers/2026-05-16-doc-audit.md` | `docs/plans/archive/2026-05-16-doc-audit.md` | `audit` | `implemented` | empty | empty |
| `docs/superpowers/specs/2026-05-16-acp-supported-features-implementation-spec.md` | `docs/plans/archive/2026-05-16-acp-supported-features-implementation-spec.md` | `spec` | `abandoned` | empty | empty |
| `docs/superpowers/plans/2026-05-16-zed-integration-and-lsp-hygiene.md` | `docs/plans/archive/2026-05-16-zed-integration-and-lsp-hygiene.md` | `plan` | `abandoned` | empty | empty |
| `docs/superpowers/specs/2026-05-26-hindsight-codex-local-integration-design.md` | `docs/plans/archive/2026-05-26-hindsight-codex-local-integration-design.md` | `spec` | `abandoned` | empty | empty |
| `docs/superpowers/plans/2026-05-26-hindsight-codex-local-integration.md` | `docs/plans/archive/2026-05-26-hindsight-codex-local-integration.md` | `plan` | `abandoned` | `2026-05-26-hindsight-codex-local-integration-design` | empty |

Each moved file gets front matter with its table values, `created:` from the filename date, and `archived: 2026-06-25`.

- [x] **Step 2 — Regenerate and validate.**

Run:

```bash
cd /Users/joaichberger/Projects/omp-agent-setup
omp-plans index
omp-plans check
```

Expected: validation succeeds and no `docs/superpowers/**` planning docs remain.

- [x] **Step 3 — Commit the setup migration.**

Run:

```bash
cd /Users/joaichberger/Projects/omp-agent-setup
git add docs/plans docs/superpowers
git commit -m "docs(plans): migrate legacy setup planning docs"
```

Expected: one commit that moves all setup planning artifacts into `docs/plans/archive/`.

---

### Task 3: Migrate `test-generalization-dev` planning artifacts

**Files:**
- Move from legacy locations:
  - `/Users/joaichberger/Projects/test-generalization-dev/docs/superpowers/specs/2026-06-24-agent-instruction-files-normalization-design.md`
  - `/Users/joaichberger/Projects/test-generalization-dev/docs/superpowers/plans/2026-06-24-dev-repo-agent-setup.md`
  - `/Users/joaichberger/Projects/test-generalization-dev/docs/superpowers/plans/2026-06-24-paper-repo-agent-setup.md`
  - `/Users/joaichberger/Projects/test-generalization-dev/docs/superpowers/plans/2026-06-24-shared-writing-skills-plugin.md`
  - `/Users/joaichberger/Projects/test-generalization-dev/docs/superpowers/plans/2026-06-24-thesis-repo-agent-setup.md`
  - `/Users/joaichberger/Projects/test-generalization-dev/.claude/plans/virtual-beaming-shore.md`
- Create: `/Users/joaichberger/Projects/test-generalization-dev/docs/plans/INDEX.md`

- [ ] **Step 1 — Move the instruction-normalization docs to archive.**

Use these target paths and front-matter values:

| Source | Target | type | status | parent |
|---|---|---|---|---|
| `docs/superpowers/specs/2026-06-24-agent-instruction-files-normalization-design.md` | `docs/plans/archive/2026-06-24-agent-instruction-files-normalization-design.md` | `spec` | `implemented` | empty |
| `docs/superpowers/plans/2026-06-24-dev-repo-agent-setup.md` | `docs/plans/archive/2026-06-24-dev-repo-agent-setup.md` | `plan` | `implemented` | `2026-06-24-agent-instruction-files-normalization-design` |
| `docs/superpowers/plans/2026-06-24-paper-repo-agent-setup.md` | `docs/plans/archive/2026-06-24-paper-repo-agent-setup.md` | `plan` | `implemented` | `2026-06-24-agent-instruction-files-normalization-design` |
| `docs/superpowers/plans/2026-06-24-shared-writing-skills-plugin.md` | `docs/plans/archive/2026-06-24-shared-writing-skills-plugin.md` | `plan` | `implemented` | `2026-06-24-agent-instruction-files-normalization-design` |
| `docs/superpowers/plans/2026-06-24-thesis-repo-agent-setup.md` | `docs/plans/archive/2026-06-24-thesis-repo-agent-setup.md` | `plan` | `implemented` | `2026-06-24-agent-instruction-files-normalization-design` |

Each archived file gets `created: 2026-06-24` and `archived: 2026-06-25`.

- [ ] **Step 2 — Move the replication-package plan to active docs.**

Move:

```text
.claude/plans/virtual-beaming-shore.md
```

to:

```text
docs/plans/2026-06-25-replication-package-documentation-improvements.md
```

Add this front matter:

```yaml
---
title: Replication Package Documentation Improvements
type: plan
status: active
created: 2026-06-25
parent:
---
```

This file remains active because it describes evaluator-facing replication-package work and has not been verified as shipped in the instruction-normalization commits.

- [ ] **Step 3 — Regenerate and validate.**

Run:

```bash
cd /Users/joaichberger/Projects/test-generalization-dev
omp-plans index
omp-plans check
```

Expected: `docs/plans/INDEX.md` exists, validation succeeds, and no planning files remain under `docs/superpowers/**` or `.claude/plans/**`.

- [ ] **Step 4 — Commit the dev migration.**

Run:

```bash
cd /Users/joaichberger/Projects/test-generalization-dev
git add docs/plans docs/superpowers .claude/plans
git commit -m "docs(plans): migrate planning docs to docs/plans"
```

Expected: a commit containing only planning-doc moves/metadata/index changes.

---

### Task 4: Migrate `phd-thesis` planning artifacts

**Files:**
- Move every document under:
  - `/Users/joaichberger/Projects/phd-thesis/plans/*.md`
  - `/Users/joaichberger/Projects/phd-thesis/plans/specs/*.md`
- Create: `/Users/joaichberger/Projects/phd-thesis/docs/plans/INDEX.md`

- [ ] **Step 1 — Move the thesis docs according to this table.**

| Source | Target | type | status | parent | superseded_by |
|---|---|---|---|---|---|
| `plans/2026-05-16-reflections-rewrite-plan.md` | `docs/plans/archive/2026-05-16-reflections-rewrite-plan.md` | `plan` | `implemented` | empty | empty |
| `plans/specs/2026-05-21-section-6-2-lessons-design.md` | `docs/plans/archive/2026-05-21-section-6-2-lessons-design.md` | `spec` | `superseded` | empty | `2026-05-24-section-6-2-revision-spec` |
| `plans/specs/2026-05-24-section-6-2-revision-spec.md` | `docs/plans/archive/2026-05-24-section-6-2-revision-spec.md` | `spec` | `superseded` | empty | `2026-05-24-section-6-2-synthesis-revision` |
| `plans/specs/2026-05-24-section-6-2-synthesis-revision.md` | `docs/plans/archive/2026-05-24-section-6-2-synthesis-revision.md` | `spec` | `implemented` | empty | empty |
| `plans/specs/2026-05-25-section-6-3-barriers-design.md` | `docs/plans/archive/2026-05-25-section-6-3-barriers-design.md` | `spec` | `implemented` | empty | empty |
| `plans/specs/2026-05-29-conclusion-chapter-design.md` | `docs/plans/archive/2026-05-29-conclusion-chapter-design.md` | `spec` | `implemented` | empty | empty |
| `plans/specs/2026-05-29-section-6-4-downstream-design.md` | `docs/plans/archive/2026-05-29-section-6-4-downstream-design.md` | `spec` | `superseded` | empty | `2026-05-30-section-6-4-directions-design` |
| `plans/specs/2026-05-30-agent-files-and-literature-workflow-design.md` | `docs/plans/archive/2026-05-30-agent-files-and-literature-workflow-design.md` | `spec` | `implemented` | empty | empty |
| `plans/specs/2026-05-30-section-6-4-directions-design.md` | `docs/plans/archive/2026-05-30-section-6-4-directions-design.md` | `spec` | `superseded` | empty | `2026-06-09-section-6-4-restructure-design` |
| `plans/specs/2026-06-08-published-work-attribution.md` | `docs/plans/2026-06-08-published-work-attribution.md` | `spec` | `active` | empty | empty |
| `plans/specs/2026-06-09-section-6-4-restructure-design.md` | `docs/plans/archive/2026-06-09-section-6-4-restructure-design.md` | `spec` | `implemented` | empty | empty |
| `plans/2026-06-12-bib-verification-log.md` | `docs/plans/archive/2026-06-12-bib-verification-log.md` | `note` | `implemented` | empty | empty |
| `plans/2026-06-12-citation-claim-audit.md` | `docs/plans/archive/2026-06-12-citation-claim-audit.md` | `audit` | `implemented` | empty | empty |
| `plans/2026-06-13-downstream-evidence-use-notes.md` | `docs/plans/archive/2026-06-13-downstream-evidence-use-notes.md` | `note` | `implemented` | empty | empty |
| `plans/2026-06-14-future-directions-consolidated.md` | `docs/plans/archive/2026-06-14-future-directions-consolidated.md` | `note` | `implemented` | empty | empty |
| `plans/2026-06-15-teralizer-float-placement.md` | `docs/plans/2026-06-15-teralizer-float-placement.md` | `plan` | `active` | empty | empty |
| `plans/specs/2026-06-15-thesis-design-system.md` | `docs/plans/2026-06-15-thesis-design-system.md` | `spec` | `active` | empty | empty |
| `plans/2026-06-15-thesis-design-system-plan.md` | `docs/plans/2026-06-15-thesis-design-system-plan.md` | `plan` | `active` | `2026-06-15-thesis-design-system` | empty |
| `plans/2026-06-20-acknowledgments-plan.md` | `docs/plans/2026-06-20-acknowledgments-plan.md` | `plan` | `draft` | empty | empty |

Every archived file gets `archived: 2026-06-25`. Active/draft files leave `archived:` blank or omit it.

- [ ] **Step 2 — Add front matter to every moved thesis document.**

Use each row's exact `title` from the first heading, `type`, `status`, `parent`, and `superseded_by`; `created:` is the date prefix in the filename. The existing body starts after the front matter and remains otherwise unchanged except for path references that must point from `plans/...` to `docs/plans/...`.

- [ ] **Step 3 — Regenerate and validate.**

Run:

```bash
cd /Users/joaichberger/Projects/phd-thesis
omp-plans index
omp-plans check
```

Expected: validation succeeds, `docs/plans/INDEX.md` exists, and no planning files remain under `plans/` or `plans/specs/`.

- [ ] **Step 4 — Commit the thesis migration.**

Run:

```bash
cd /Users/joaichberger/Projects/phd-thesis
git add docs/plans plans
git commit -m "docs(plans): migrate thesis planning docs to docs/plans"
```

Expected: a commit containing only planning-doc moves/metadata/index changes. Existing non-planning WIP (`.gitignore`, feedback files, unrelated notes) remains untouched unless it is itself a planning artifact.

---

### Task 5: Confirm `test-generalization-paper` stays planless

**Files:**
- No file changes expected in `/Users/joaichberger/Projects/test-generalization-paper` unless new planning artifacts are discovered.

- [ ] **Step 1 — Confirm no planning docs exist.**

Run:

```bash
cd /Users/joaichberger/Projects/test-generalization-paper
find docs plans .claude -path '*/plans/*' -o -path '*/specs/*' 2>/dev/null | sort
```

Expected: no planning artifacts. If artifacts appear, migrate them under the inclusion rule in this plan.

- [ ] **Step 2 — Confirm `omp-plans` no-ops.**

Run:

```bash
cd /Users/joaichberger/Projects/test-generalization-paper
omp-plans status
```

Expected: no output because the repo has no `docs/plans/` directory.

---

### Task 6: Fleet verification

**Files:**
- Modify only `docs/plans/INDEX.md` files if `omp-plans index` reports drift.

- [ ] **Step 1 — Run fleet status.**

Run:

```bash
cd /Users/joaichberger/Projects/omp-agent-setup
omp-plans status --fleet
```

Expected: `omp-agent-setup`, `Erenshor`, `test-generalization-dev`, and `phd-thesis` appear with sane active/implemented/archive status; `test-generalization-paper` remains absent or empty because it has no planning docs.

- [ ] **Step 2 — Run per-repo checks.**

Run:

```bash
for repo in \
  /Users/joaichberger/Projects/omp-agent-setup \
  /Users/joaichberger/Projects/Erenshor \
  /Users/joaichberger/Projects/test-generalization-dev \
  /Users/joaichberger/Projects/phd-thesis; do
  echo "=== $repo ==="
  (cd "$repo" && omp-plans check)
done
```

Expected: every repo reports `ok (...)`.

- [ ] **Step 3 — Search for legacy planning locations.**

Run:

```bash
for repo in \
  /Users/joaichberger/Projects/omp-agent-setup \
  /Users/joaichberger/Projects/test-generalization-dev \
  /Users/joaichberger/Projects/phd-thesis; do
  echo "=== $repo ==="
  find "$repo" \
    -path '*/docs/superpowers/plans/*' -o \
    -path '*/docs/superpowers/specs/*' -o \
    -path '*/.claude/plans/*' -o \
    -path '*/plans/specs/*' -o \
    -path '*/plans/*.md'
done
```

Expected: no legacy planning files remain in the migrated repos.

- [ ] **Step 4 — Commit any final index updates.**

If a repo has only `INDEX.md` drift after validation, commit that drift in the repo that owns it with:

```bash
git add docs/plans/INDEX.md
git commit -m "docs(plans): refresh planning index"
```

Expected: all planning migrations are committed, and unrelated WIP remains unstaged.
