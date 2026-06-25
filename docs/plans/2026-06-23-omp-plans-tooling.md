---
title: omp-plans Tooling, Skill & Global Convention
type: plan
status: active
created: 2026-06-23
parent: 2026-06-23-planning-file-conventions-design
---

# omp-plans Tooling, Skill & Global Convention — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `skill://executing-plans` (inline, no worktree — this user's standing preference). Steps use `- [ ]` checkboxes. Read the design spec (relocated in Task 18 to `docs/plans/2026-06-23-planning-file-conventions-design.md`) and `skill://writing-skills` / `skill://writing-agent-instructions` before the skill/AGENTS tasks.

**Goal:** Ship a global, repo-agnostic `omp-plans` Bun CLI + a generic `planning-files` skill + a 3-line global AGENTS.md breadcrumb, deployed by `omp-agent-setup`, so every repo gets the same planning-doc convention, index, and status/validation tooling.

**Architecture:** Pure core (`src/plans.ts`: front-matter parse, scoped checkbox counting, status/staleness classification, link validation, index/status rendering) + real-IO adapters (`src/plans-runtime.ts`: fs discovery, git last-touched, config merge) + CLI glue (`src/plans-cli.ts`) — mirroring the existing `lsp-audit.ts`/`-runtime.ts` and `bin-link.ts`/`-runtime.ts` splits. Deployed as a managed PATH bin `omp-plans` and a managed skill, gated by `doctor`/`verify`, rolled back via `backups/`.

**Tech Stack:** Bun 1.3.14 + TypeScript, `yaml` (already a dep), `bun test --coverage` (0.8 threshold on pure logic), Biome, tsc, knip.

**Conventions (match the repo):** every `src/<name>.ts` is pure logic with real-IO in `src/<name>-runtime.ts`; pure logic gets unit tests before merge; runtime is injected into pure functions as parameters. Commit per task (Conventional Commits, `skill://commit`).

---

## Phase A — Pure core (`src/plans.ts`) + unit tests

### Task 1: Front-matter parse + schema validation

**Files:** Create `src/plans.ts`; Test `tests/plans.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { expect, test } from "bun:test";
import { parseDoc, validateDoc, type ParsedDoc } from "../src/plans.ts";

test("parseDoc extracts front-matter and body", () => {
  const d = parseDoc("a.md", "---\ntitle: A\ntype: plan\nstatus: active\ncreated: 2026-06-23\n---\n# A\n- [x] one\n");
  expect(d.frontMatter.type).toBe("plan");
  expect(d.frontMatter.status).toBe("active");
  expect(d.body).toContain("# A");
});

test("validateDoc rejects bad type/status and missing required keys", () => {
  const bad = parseDoc("b.md", "---\ntitle: B\ntype: bogus\nstatus: active\ncreated: 2026-06-23\n---\n");
  expect(validateDoc(bad).map((e) => e.code)).toContain("bad-type");
  const noStatus = parseDoc("c.md", "---\ntitle: C\ntype: plan\ncreated: 2026-06-23\n---\n");
  expect(validateDoc(noStatus).map((e) => e.code)).toContain("missing-status");
});
```

- [ ] **Step 2:** Run `bun test tests/plans.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `parseDoc` (split `---` front-matter, parse via `yaml`) and `validateDoc`:

```ts
import { parse as parseYaml } from "yaml";

export const DOC_TYPES = ["spec", "plan", "prd", "audit", "note"] as const;
export const DOC_STATUSES = ["draft", "active", "implemented", "superseded", "abandoned"] as const;
export type DocType = (typeof DOC_TYPES)[number];
export type DocStatus = (typeof DOC_STATUSES)[number];

export interface FrontMatter {
  title?: string; type?: string; status?: string; created?: string;
  parent?: string; superseded_by?: string; archived?: string;
}
export interface ParsedDoc { slug: string; frontMatter: FrontMatter; body: string; }
export interface DocError { slug: string; code: string; message: string; }

const FM_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseDoc(path: string, content: string): ParsedDoc {
  const slug = path.replace(/^.*\//, "").replace(/\.md$/, "");
  const m = content.match(FM_RE);
  if (!m) return { slug, frontMatter: {}, body: content };
  return { slug, frontMatter: (parseYaml(m[1]) ?? {}) as FrontMatter, body: m[2] };
}

export function validateDoc(doc: ParsedDoc): DocError[] {
  const e: DocError[] = [];
  const fm = doc.frontMatter;
  const req = (k: keyof FrontMatter, code: string) => { if (!fm[k]) e.push({ slug: doc.slug, code, message: `missing ${k}` }); };
  req("title", "missing-title"); req("type", "missing-type"); req("status", "missing-status"); req("created", "missing-created");
  if (fm.type && !DOC_TYPES.includes(fm.type as DocType)) e.push({ slug: doc.slug, code: "bad-type", message: `type=${fm.type}` });
  if (fm.status && !DOC_STATUSES.includes(fm.status as DocStatus)) e.push({ slug: doc.slug, code: "bad-status", message: `status=${fm.status}` });
  if (fm.status === "superseded" && !fm.superseded_by) e.push({ slug: doc.slug, code: "missing-superseded_by", message: "superseded needs superseded_by" });
  return e;
}
```

- [ ] **Step 4:** Run the tests → PASS.
- [ ] **Step 5: Commit** — `feat(plans): parse and validate planning-doc front-matter`

### Task 2: Scoped checkbox counting

**Files:** Modify `src/plans.ts`; `tests/plans.test.ts`

- [ ] **Step 1: Write failing test** — checkboxes count only under `## Tasks` / `### Task N`, never inside fenced code or illustrative lists:

```ts
import { countTasks } from "../src/plans.ts";
test("countTasks scopes to task sections and ignores code fences", () => {
  const body = [
    "Intro", "- [ ] not a task (no section)",
    "## Tasks", "- [x] done", "- [ ] todo",
    "```", "- [ ] fenced example", "```",
    "### Task 5: thing", "- [x] sub",
  ].join("\n");
  expect(countTasks(body)).toEqual({ done: 2, total: 3 });
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `countTasks`: track whether the current line is inside a fenced block (toggle on ```` ``` ````), and whether the nearest heading is a task section (`^## Tasks` or `^### Task `); count `^\s*- \[( |x)\]` only when in a task section and not fenced.

```ts
export function countTasks(body: string): { done: number; total: number } {
  let inFence = false, inTaskSection = false, done = 0, total = 0;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^#{1,6}\s/.test(line)) inTaskSection = /^##\s+Tasks\b/.test(line) || /^###\s+Task\s/i.test(line);
    if (!inTaskSection) continue;
    const m = line.match(/^\s*-\s+\[( |x|X)\]\s/);
    if (m) { total++; if (m[1].toLowerCase() === "x") done++; }
  }
  return { done, total };
}
```

- [ ] **Step 4:** Run → PASS. **Step 5: Commit** — `feat(plans): scoped checkbox task counting`

### Task 3: Status classification (staleness, archive-age, completion)

**Files:** Modify `src/plans.ts`; `tests/plans.test.ts`

- [ ] **Step 1: Write failing test** for `classifyDoc` (thresholds like `DEFAULT_ACTIVITY` in lsp-audit):

```ts
import { classifyDoc, DEFAULT_THRESHOLDS } from "../src/plans.ts";
const now = new Date("2026-06-23");
test("classifyDoc flags stale-active, complete, and deletable-archive", () => {
  const stale = classifyDoc({ status: "active", lastTouched: new Date("2026-01-01"), tasks: { done: 1, total: 3 }, archived: null }, now, DEFAULT_THRESHOLDS);
  expect(stale.flags).toContain("stale");
  const complete = classifyDoc({ status: "active", lastTouched: now, tasks: { done: 3, total: 3 }, archived: null }, now, DEFAULT_THRESHOLDS);
  expect(complete.flags).toContain("complete");
  const del = classifyDoc({ status: "superseded", lastTouched: now, tasks: { done: 0, total: 0 }, archived: new Date("2025-01-01") }, now, DEFAULT_THRESHOLDS);
  expect(del.flags).toContain("deletable");
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `DEFAULT_THRESHOLDS = { staleDays: 60, archiveDeleteDays: 180 }` and `classifyDoc` computing `flags: ("stale"|"complete"|"deletable")[]` (stale = status active & age>staleDays; complete = status active & total>0 & done===total; deletable = archived & archive-age>archiveDeleteDays). Day math via `(now - date)/86400000`.
- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(plans): classify staleness, completion, and archive-age`

### Task 4: Cross-doc link integrity

**Files:** Modify `src/plans.ts`; `tests/plans.test.ts`

- [ ] **Step 1: Write failing test** — `validateLinks(docs)` flags `parent`/`superseded_by` slugs that don't resolve to a present doc:

```ts
import { validateLinks } from "../src/plans.ts";
test("validateLinks flags dangling parent/superseded_by", () => {
  const docs = [parseDoc("a.md", "---\ntitle: A\ntype: plan\nstatus: active\ncreated: 2026-06-23\nparent: ghost\n---\n")];
  expect(validateLinks(docs).map((e) => e.code)).toContain("dangling-parent");
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** `validateLinks`: build a `Set` of present slugs (including `archive/` slugs); for each doc, if `parent`/`superseded_by` set and not in the set → `DocError` (`dangling-parent` / `dangling-superseded_by`). This is the check that catches the real nav-stall breakage.
- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(plans): validate parent/superseded_by link integrity`

### Task 5: INDEX.md + status renderers

**Files:** Modify `src/plans.ts`; `tests/plans.test.ts`

- [ ] **Step 1: Write failing tests** — `renderIndex(rows)` groups active/draft by status, shows title/type/slug/completion/parent, excludes archived (one trailing archive link); `renderStatus(rows, { json })` returns a stable table or JSON.
- [ ] **Step 2:** FAIL. **Step 3: Implement** `renderIndex` and `renderStatus` as pure string builders over a `DocRow` shape (slug, frontMatter, lastTouched, tasks, flags). Deterministic ordering (status rank, then slug) for snapshot stability — mirror `renderReport` in `lsp-audit.ts`.
- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(plans): render INDEX.md and status output`

---

## Phase B — Real-IO adapters (`src/plans-runtime.ts`)

### Task 6: Discovery, git freshness, config merge

**Files:** Create `src/plans-runtime.ts`; `tests/plans-runtime.test.ts` (integration, sandboxed tmp dir + real git per the existing `tests/integration/` convention)

- [ ] **Step 1: Write failing integration test** in a tmp git repo: create `docs/plans/x.md` (+ a commit, + a `[docs-skip]` commit), assert `gitLastTouched` ignores the `[docs-skip]` commit; assert `discoverDocs` finds the doc and `loadConfig` merges `docs/plans/plans.toml` over defaults.
- [ ] **Step 2:** FAIL. **Step 3: Implement**:
  - `discoverDocs(repoRoot)` — read `docs/plans/*.md` and `docs/plans/archive/*.md` (skip `INDEX.md`); return `{ path, content, archived: boolean }[]`. **No-op (empty) when `docs/plans/` absent.**
  - `gitLastTouched(repoRoot, relPath)` — `git log --format=%cI -- <relPath>`, skipping commits whose subject contains `[docs-skip]` (shell out via `Bun.spawn`/`captureGit`, mirroring `cli.ts` git usage); parse to `Date | null`.
  - `loadConfig(repoRoot)` — start from `DEFAULT_THRESHOLDS`; if `docs/plans/plans.toml` exists, read `stale_days`/`archive_delete_days` (reuse `extractTomlTable` from `plans.ts`/`lsp-audit.ts` style) and merge. **No `path` key** (location is fixed).
  - `archivedDate(doc)` — from front-matter `archived:`.
- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(plans): fs discovery, git last-touched, config merge`

---

## Phase C — CLI + managed bin

### Task 7: `plans-cli.ts` entry (`index` / `check` / `status`)

**Files:** Create `src/plans-cli.ts` (shebang `#!/usr/bin/env bun`, `chmod +x`); `tests/plans-cli.test.ts` (smoke, run against a tmp repo via `Bun.spawn`)

- [ ] **Step 1: Write failing smoke test** — `bun src/plans-cli.ts status --json` in a tmp repo with one doc emits JSON with that doc; `check` exits non-zero on a dangling link; `index` writes `docs/plans/INDEX.md`; all commands **exit 0 and no-op when `docs/plans/` absent**.
- [ ] **Step 2:** FAIL. **Step 3: Implement** arg parsing (subcommand + `--active|--stale|--complete|--archive`, `--json`, `--fleet`); compose runtime adapters → pure core; `index` is the only writer; `check` returns non-zero on any `DocError`; `--fleet` reuses `discoverRepos` from `lsp-audit-runtime.ts` to sweep `~/Projects`. Set the exec bit.
- [ ] **Step 4:** PASS. **Step 5: Commit** — `feat(plans): omp-plans CLI (index/check/status, --fleet/--json)`

### Task 8: Managed `omp-plans` bin (symlink + doctor/verify)

**Files:** Modify `src/bootstrap.ts`, `src/cli.ts`; reuse `src/bin-link*.ts`

- [ ] **Step 1:** In `bootstrap.ts`, after the existing `executeBinLink` wiring (around the omp-bin step), add a managed symlink `$BUN_INSTALL/bin/omp-plans → <repoRoot>/src/plans-cli.ts` using the same `probeBinState`/`symlink` pattern (target = the source CLI; `isUsableSourceEntry` guards the exec bit). Snapshot it into `backups/` like other managed paths.
- [ ] **Step 2:** In `cli.ts` `doctor` (managedAgentChecks), add an `omp-plans bin` lstat check mirroring the `omp bin` check; in `verify`, add a smoke that `omp-plans --help` exits 0.
- [ ] **Step 3:** `bun run bootstrap` then `bun run doctor` → reports `ok omp-plans bin`. `omp-plans status` runs from an arbitrary repo.
- [ ] **Step 4: Commit** — `feat(setup): deploy omp-plans as a managed PATH bin`

---

## Phase D — Skill, AGENTS breadcrumb, config, relocate spec

### Task 9: `planning-files` skill (generic)

**Files:** Create `agent/skills/planning-files/SKILL.md`

- [ ] **Step 1:** Write the skill per `skill://writing-skills` (50–100 lines, project-agnostic, command `omp-plans`, **reference `omp-plans --help` for flags, don't enumerate**). Frontmatter `description` must be trigger-rich:

```yaml
---
name: planning-files
description: Conventions and tooling for planning docs in docs/plans/ (front-matter, status lifecycle, INDEX.md, the omp-plans CLI). Use when creating, resuming, or finishing a plan or spec; checking what work is active or stale across sessions; validating planning docs; or working anywhere under docs/plans/.
---
```

Body: the front-matter schema; status lifecycle; naming; scoped checkbox rule; the agent workflow (read `INDEX.md` → `omp-plans status --active` → resume from unchecked tasks → check boxes in the same commit → on completion `omp-plans check`, mark `implemented`, archive, `omp-plans index`); "no in-file progress log — history is in git"; pointer to `omp-plans --help`.

- [ ] **Step 2: Commit** — `feat(skill): add the planning-files convention skill`

### Task 10: Register the skill

**Files:** Modify `src/managed-skills.ts`, `agent/AGENTS.md`

- [ ] **Step 1:** Add `"planning-files"` to `LOCAL_MANAGED_SKILLS`. Add it to the managed-skills ownership list in `agent/AGENTS.md:19`.
- [ ] **Step 2:** `bun run bootstrap` → symlink `~/.omp/agent/skills/planning-files` created; `bun run verify` → `REQUIRED_SKILLS` includes it and the skill-loader check passes.
- [ ] **Step 3: Commit** — `feat(setup): register the planning-files managed skill`

### Task 11: Global AGENTS.md breadcrumb

**Files:** Modify `agent/AGENTS.md`

- [ ] **Step 1:** Add the ~3-line block (per `skill://writing-agent-instructions`, lean, link-don't-inline):

```markdown
## Planning files
Planning artifacts live in `docs/plans/` in every repo (planless repos are fine until the first plan). Before resuming multi-session work, run `omp-plans status`; `omp-plans index`/`check` maintain `docs/plans/INDEX.md` and validate front-matter. Full convention: `skill://planning-files`.
```

- [ ] **Step 2:** `bun run bootstrap`; confirm the deployed `~/.omp/agent/AGENTS.md` carries it.
- [ ] **Step 3: Commit** — `docs(agent): add the planning-files breadcrumb to global AGENTS.md`

### Task 12: Relocate the design spec

**Files:** Move `~/Projects/Erenshor/docs/plans/2026-06-23-planning-file-conventions-design.md` → `docs/plans/2026-06-23-planning-file-conventions-design.md` (this repo)

- [ ] **Step 1:** Create `docs/plans/` here if absent. **Copy** the spec from `~/Projects/Erenshor/docs/plans/2026-06-23-planning-file-conventions-design.md` into this repo's `docs/plans/` (cross-repo → copy, not `git mv`), `git add` it, and set its `status: implemented` once this plan completes. The Erenshor-side copy is removed by the Erenshor adoption plan (its Task 1).
- [ ] **Step 2:** `omp-plans check` resolves the `parent` link from this plan to the spec. **Commit** — `docs(plans): adopt planning convention spec as the authoritative copy`

### Task 13: Generate INDEX + full gate

- [ ] **Step 1:** `omp-plans index` → write `docs/plans/INDEX.md`; commit it.
- [ ] **Step 2:** `bun run ci` (lint + types + dead-code + audit + `bun test --coverage` ≥ 0.8 on pure logic) → green. `bun run doctor` / `bun run verify` → green.
- [ ] **Step 3: Commit** — `test(plans): index + green ci/doctor/verify`

---

## Self-review
- **Spec coverage:** convention (skill), tooling (`omp-plans` Phases A–C), discoverability (skill + AGENTS breadcrumb, no MCP), config (`plans.toml` thresholds-only), location override (AGENTS block) — all present. Erenshor migration + no-worktrees override are the *other* plan.
- **No placeholders:** each task has real code/commands + expected results.
- **Pattern fidelity:** pure/runtime split, injected fs/git, managed-skill one-line register, managed-bin via the `bin-link` pattern, `doctor`/`verify` gating — all mirror existing repo code.
- **Type consistency:** `ParsedDoc`/`FrontMatter`/`DocError`/`DEFAULT_THRESHOLDS`/`countTasks`/`classifyDoc`/`validateLinks`/`renderIndex`/`renderStatus` used identically across tasks.
