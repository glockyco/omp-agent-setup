---
title: Zed Integration & LSP Hygiene Implementation Plan
type: plan
status: abandoned
created: 2026-05-16
parent:
superseded_by:
archived: 2026-06-25
---

# Zed Integration & LSP Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the recurring Zed error storms in `~/Library/Logs/Zed/Zed.log` by (1) cleaning the stale single-file-worktree state safely (WAL-aware backup, FK-aware deletes), (2) settling on a defensible C# LSP split (Zed → Roslyn as the steady state, OMP → csharp-ls; OmniSharp remains a documented contingency), and (3) wiring OMP into Zed via ACP as a managed surface of this repo with an absolute, machine-resolved binary path.

**Architecture:** Zed-side configuration becomes a new managed surface alongside `~/.omp/agent/config.yml`. A small JSONC merger (`src/zed-settings.ts` + `src/zed-settings-runtime.ts`) edits `~/.config/zed/settings.json` in place using `jsonc-parser`'s `modify`/`applyEdits` (character-offset edits, so comments and unrelated keys survive). The merger validates the existing JSONC via `parseTree(text, errors)` and refuses to touch a syntactically-broken file rather than silently corrupting it. The runtime adapter resolves the `omp` binary via `Bun.which("omp")` so the managed entry uses an absolute path (avoiding GUI-launched Zed's PATH ambiguity). Only `agent_servers["omp-acp"]` is managed; `languages.CSharp`, themes, panel placements, etc. are user-owned.

**Tech Stack:** Bun, TypeScript, `bun:test`, [`jsonc-parser`](https://github.com/microsoft/node-jsonc-parser) (Microsoft's VS Code JSONC editor — `modify`/`applyEdits` for writes, `findNodeAtLocation` + `getNodeValue` for reads, `parseTree(text, errors)` for validation), `sqlite3` CLI for the one-time WAL-aware DB cleanup.

---

## Pre-flight evidence (captured 2026-05-16, verified by reviewers)

### Stale Zed editors

Three rows in `~/Library/Application Support/Zed/db/0-stable/db.sqlite` `editors`:

| workspace_id | host workspace | item_id |
|---|---|---|
| 19 | `/Users/joaichberger/Projects/ancient-kingdoms-mods` | `90194315842` |
| 19 | `/Users/joaichberger/Projects/ancient-kingdoms-mods` | `73014446801` |
| 16 | `/Users/joaichberger/Projects/phd-thesis` | `339302419299` |

Dependent rows confirmed via direct sqlite3 queries (2026-05-16):

| Table | Matching rows for those item_ids | Cleanup status |
|---|---|---|
| `editor_selections` (FK → editors, ON DELETE CASCADE) | 1 (`757\|90194315842\|19\|684\|684`) | **Must delete** — `PRAGMA foreign_keys` is `0` in the sqlite3 shell session, so CASCADE does not fire automatically. |
| `editor_folds` | 0 | n/a |
| `vim_marks` (path-based, no FK) | 5 by path match | Optional hygiene — does not orphan any rows. |
| `bookmarks`, `panes`, `pane_groups` | 0 referencing these item_ids | n/a |

The DB is in **WAL mode** (`PRAGMA journal_mode` → `wal`); `db.sqlite-wal` and `db.sqlite-shm` sidecars are present. SQLite's [WAL docs](https://www.sqlite.org/wal.html) and [backup docs](https://www.sqlite.org/backup.html) require either the `.backup` command (atomic, includes WAL state) or copying all three files together after the writer has cleanly closed. Copying `db.sqlite` alone risks an inconsistent snapshot.

Cascading log errors that disappear once the three rows + dependents are gone: `json-language-server`/`package-version-server` spawn failures (cwd missing), `Failed to install default prettier`, `Failed to load shell environment`.

### C# LSP state

- `~/.config/zed/settings.json` currently has `"CSharp": { "language_servers": ["omnisharp", "!roslyn"] }`. The `omnisharp` binary is NOT installed under `~/Library/Application Support/Zed/languages/`. Net effect: no working C# LSP, every JSON/TS edit dispatches to a missing omnisharp and logs `server shut down`.
- The original reason for the override was [Zed #55746](https://github.com/zed-industries/zed/issues/55746) (macOS FSEvent storm on Roslyn). [Maintainer @probably-neb (2026-05-15)](https://github.com/zed-industries/zed/issues/55746#issuecomment-…) reported one half is fixed in latest stable/preview; the other half is still being worked on.
- [Zed C# docs](https://zed.dev/docs/languages/csharp) say Roslyn is enabled by default; OmniSharp is documented as a supported alternative override, not as deprecated.
- [OmniSharp 1.39.15 shipped 2025-11](https://github.com/OmniSharp/omnisharp-roslyn/blob/master/CHANGELOG.md); maintainers describe it as slow-moving but maintained, not abandoned.
- [Zed C# extension #41](https://github.com/zed-extensions/csharp/issues/41) confirms Razor/CSHTML is NOT supported by Zed's Roslyn integration. Earlier drafts of this plan claimed Razor as a Roslyn advantage; that claim has been removed.
- [csharp-ls](https://github.com/razzmatazz/csharp-language-server) has `csharp.analyzersEnabled` defaulting to `false` and active in-progress work on [source-generator support](https://github.com/razzmatazz/csharp-language-server/blob/main/plans/source-generator-support.md). Real capability gap vs Roslyn.

### `omp acp` and ACP integration

- OMP version `omp/15.1.2` at `~/.bun/bin/omp`. `omp acp` is a real subcommand (see `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/commands/acp.ts`).
- OMP is NOT in Zed's ACP Registry (the registry's `pi` entry is upstream Pi, not OMP — see [pi-acp adapter](https://github.com/svkozak/pi-acp) for the upstream adapter). A `"type": "custom"` `agent_servers` entry is required.
- [Zed external-agents docs](https://zed.dev/docs/ai/external-agents) document the `agent_servers.<name>` shape: `{ "type": "custom", "command": "...", "args": [...], "env": {...} }`. `env` is optional.
- Zed loads env from a login shell on macOS (so PATH usually contains `~/.bun/bin`), but the [reviewer's research](agent://0-ZedAcpReview) flagged that absolute paths are safer for GUI-launched Zed. We resolve `Bun.which("omp")` at bootstrap time and write the absolute path.
- Zed live-reloads `settings.json` for regular files (the `~/.config/zed/settings.json` on this machine is a regular file, not a symlink); a restart is not strictly required for the change to take effect. The plan still restarts Zed once for UX verification.

### Out of scope (acknowledged, not fixed here)

- **eslint 120s timeouts** in one unidentified project. Project-specific perf; belongs in that project's `.zed/settings.json`, not a global override.
- **Adding csharp-ls support to Zed.** Would require shipping a third-party Zed extension (e.g. wrappers around [SofusA/csharp-language-server](https://github.com/SofusA/csharp-language-server)). Documented as a deliberate non-goal in `AGENTS.md` (Task 11).

## Decision: C# LSP split

| Surface | Server | Rationale |
|---|---|---|
| Zed (IDE) | Roslyn (Zed's default; ships via the `csharp` Zed extension) | Default in upstream Zed C# docs; active upstream investment; #55746 partially fixed. Trade-off recorded: no Razor/CSHTML ([extension #41](https://github.com/zed-extensions/csharp/issues/41)), residual FSEvent churn risk on macOS until #55746 is fully resolved. |
| OMP (headless agent) | csharp-ls (`~/.dotnet/tools/csharp-ls` via `dotnet tool`) | Lightweight, cross-platform via `dotnet tool`, already wired in `agent/lsp.json` (`omnisharp` → `csharp-ls` substitution). Known asymmetry vs Roslyn: `csharp.analyzersEnabled` defaults to false (analyzer-backed diagnostics differ unless explicitly enabled), source-generator support still in upstream plan. Microsoft's standalone `Microsoft.CodeAnalysis.LanguageServer` is the eventual successor but [Jared Parsons explicitly calls it "early and very experimental"](https://github.com/dotnet/roslyn/discussions/82317), so we hold off. |
| Documented contingency | OmniSharp | Not deprecated (latest release 1.39.15 in 2025-11). Remains a valid temporary fallback if Roslyn still triggers the FSEvent storm on this machine after upgrading to latest Zed. Apple-Silicon-specific runtime path bug ([#8352](https://github.com/zed-industries/zed/issues/8352)) is resolved upstream. Not the steady state because installation was missing on this machine. |

The split is intentional and recorded in `README.md` and `AGENTS.md`. The asymmetry between Zed and OMP on analyzer/Razor/generator coverage is acknowledged — same buffer can yield slightly different diagnostics in the two surfaces; that's a known trade-off, not a bug.

## File structure

- Create `src/zed-settings.ts`: pure logic — `MANAGED_ZED_KEYS`, `buildManagedZedSettings(ctx)`, `mergeManagedZedSettings(existing, managed)`, `readZedAgentServer(text, name)`, and a `ZedSettingsParseError` thrown when the user's JSONC has syntax errors.
- Create `src/zed-settings-runtime.ts`: IO adapter — `zedSettingsPath(home)`, `resolveOmpBinary()` via `Bun.which`, `applyManagedZedSettings(opts)`. Excluded from coverage per repo convention.
- Create `tests/zed-settings.test.ts`: unit tests for merge semantics, idempotency, malformed-JSONC rejection, omp-acp readback. Also unit-tests the runtime adapter against a temp `HOME` (precedent: `tests/runtime.test.ts` does this for `runtime.ts`).
- Modify `src/bootstrap.ts`: snapshot the Zed settings path, run the merge, surface result in `BootstrapReport`.
- Modify `src/cli.ts`: extend doctor to validate the merged `omp-acp` entry by deep-equal against canonical.
- Modify `tests/integration/bootstrap.test.ts`: seed sandbox `home` with a Zed settings file, assert merge + idempotency.
- Modify `tests/cli.test.ts`: cover the new doctor check.
- Modify `package.json` / `bun.lock`: add `jsonc-parser` dep.
- Modify `agent/AGENTS.md`: add "Editor surface: Zed (ACP)" section so agents inside Zed know about the integration.
- Modify `AGENTS.md` (root): boundaries row + "Zed integration" subsection.
- Modify `README.md`: deployed table row + "Zed integration" section documenting the C# split.

---

## Phase 0: One-time Zed state hygiene

### Task 1: Backup the WAL-aware DB and prune stale rows

**Files:**
- Read: `~/Library/Application Support/Zed/db/0-stable/db.sqlite` (+ WAL sidecars)
- Backup to: `~/Library/Application Support/Zed/db/0-stable/db.sqlite.bak-2026-05-16`

**Pre-condition:** Zed quit (`Cmd+Q`).

- [ ] **Step 1: Quit Zed and verify it's gone**

Run:

```bash
osascript -e 'tell application "Zed" to quit' 2>/dev/null || true
sleep 3
pgrep -x Zed && { echo "Zed still running, abort"; exit 1; } || echo "Zed quit cleanly"
```

Expected: `Zed quit cleanly`.

- [ ] **Step 2: WAL-aware backup via `sqlite3 .backup`**

Run:

```bash
SRC="$HOME/Library/Application Support/Zed/db/0-stable/db.sqlite"
DST="$HOME/Library/Application Support/Zed/db/0-stable/db.sqlite.bak-2026-05-16"
sqlite3 "$SRC" ".backup '$DST'"
ls -la "$DST"
sqlite3 "$DST" "SELECT COUNT(*) FROM editors;"
```

`.backup` is atomic and includes the WAL state. Output expected: `ls -la` shows the new file (close in size to `db.sqlite`); the `SELECT COUNT(*)` returns a non-zero integer (proves the backup is queryable).

- [ ] **Step 3: Confirm the three target rows + dependent rows are unchanged**

Run:

```bash
DB="$HOME/Library/Application Support/Zed/db/0-stable/db.sqlite"
sqlite3 "$DB" <<'SQL'
.headers on
SELECT workspace_id, item_id, CAST(path AS TEXT) AS path FROM editors
 WHERE path LIKE '%thunderstore-team%'
    OR path LIKE '%slice-1-stabilisation%'
    OR path LIKE '%snapshot/items.json%';
SELECT 'editor_selections deps:' AS label, COUNT(*) AS n FROM editor_selections
 WHERE editor_id IN (90194315842, 73014446801, 339302419299);
SELECT 'editor_folds deps:' AS label, COUNT(*) AS n FROM editor_folds
 WHERE editor_id IN (90194315842, 73014446801, 339302419299);
SQL
```

Expected:

```
workspace_id|item_id|path
19|90194315842|/Users/joaichberger/Projects/creator-dashboard/.worktrees/creator-dashboard-implementation/src/lib/connectors/fetchers/thunderstore-team.ts
19|73014446801|/Users/joaichberger/Projects/ardenfall-compendium/docs/superpowers/plans/2026-05-07-slice-1-stabilisation.md
16|339302419299|/Users/joaichberger/Projects/ardenfall-archives/.worktrees/slice-1-item-walking-skeleton/fixtures/synthetic/snapshot/items.json
label|n
editor_selections deps:|1
label|n
editor_folds deps:|0
```

If the item_ids differ (Zed was reopened and reassigned), abort and re-run the diagnostic from the pre-flight section.

- [ ] **Step 4: Delete in a FK-enforcing transaction**

Run:

```bash
DB="$HOME/Library/Application Support/Zed/db/0-stable/db.sqlite"
sqlite3 "$DB" <<'SQL'
PRAGMA foreign_keys = ON;
BEGIN;
DELETE FROM editor_selections WHERE editor_id IN (90194315842, 73014446801, 339302419299);
DELETE FROM editor_folds      WHERE editor_id IN (90194315842, 73014446801, 339302419299);
DELETE FROM editors           WHERE item_id   IN (90194315842, 73014446801, 339302419299);
DELETE FROM items             WHERE item_id   IN (90194315842, 73014446801, 339302419299);
COMMIT;
SQL
```

`PRAGMA foreign_keys = ON` is per-connection and resets to `OFF` after the session closes; Zed itself uses its own connection settings. Explicit deletes of `editor_selections` / `editor_folds` make the cleanup correct regardless of FK enforcement.

- [ ] **Step 5: Verify rows are gone and no orphans remain**

Run:

```bash
DB="$HOME/Library/Application Support/Zed/db/0-stable/db.sqlite"
sqlite3 "$DB" <<'SQL'
SELECT 'editors:' AS label, COUNT(*) AS n FROM editors
 WHERE item_id IN (90194315842, 73014446801, 339302419299);
SELECT 'items:', COUNT(*) FROM items
 WHERE item_id IN (90194315842, 73014446801, 339302419299);
SELECT 'editor_selections orphans:', COUNT(*) FROM editor_selections
 WHERE editor_id IN (90194315842, 73014446801, 339302419299);
SQL
```

Expected every count: `0`.

- [ ] **Step 6: (Optional) Prune stale `vim_marks` by path**

These don't cause referential integrity issues but they do hold vim-mode jumplist state pointing at missing files. Skip if you don't use vim mode.

```bash
DB="$HOME/Library/Application Support/Zed/db/0-stable/db.sqlite"
sqlite3 "$DB" <<'SQL'
BEGIN;
DELETE FROM vim_marks
 WHERE CAST(path AS TEXT) LIKE '%thunderstore-team%'
    OR CAST(path AS TEXT) LIKE '%slice-1-stabilisation%'
    OR CAST(path AS TEXT) LIKE '%snapshot/items.json%';
COMMIT;
SQL
```

- [ ] **Step 7: Smoke test — reopen Zed, scan log**

```bash
open -a Zed
sleep 8
tail -n 40 "$HOME/Library/Logs/Zed/Zed.log"
```

Expected: no `worktree root <one of the three paths> no longer exists` lines after the new Zed start timestamp. omnisharp errors may still be present — Phase 2 fixes those.

- [ ] **Step 8: No commit (runtime state only)**

Skip — this task changes user state, not repo state.

---

## Phase 1: Managed Zed settings infrastructure

### Task 2: Add `jsonc-parser` dependency

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Install**

```bash
bun add jsonc-parser@^3.3.1
```

Expected: `package.json` gains `"jsonc-parser": "^3.3.1"` under `dependencies`; `bun.lock` updates.

- [ ] **Step 2: Verify the APIs we'll use**

```bash
bun -e 'import { modify, applyEdits, parseTree, findNodeAtLocation, getNodeValue } from "jsonc-parser";
  const errors = [];
  const tree = parseTree("{ // keep\n  \"a\": 1\n}", errors);
  if (errors.length || !tree) throw new Error("parseTree failed");
  const node = findNodeAtLocation(tree, ["a"]);
  console.log("getNodeValue", getNodeValue(node));
  const edits = modify("{ // keep\n  \"a\": 1\n}", ["b"], 2, {
    formattingOptions: { tabSize: 2, insertSpaces: true, eol: "\n" }
  });
  console.log(applyEdits("{ // keep\n  \"a\": 1\n}", edits));'
```

Expected output:

```
getNodeValue 1
{ // keep
  "a": 1,
  "b": 2
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): add jsonc-parser for Zed settings merge"
```

### Task 3: TDD `src/zed-settings.ts` — pure merge logic

**Files:**
- Create: `src/zed-settings.ts`
- Create: `tests/zed-settings.test.ts`

The module exposes:
- `MANAGED_ZED_KEYS: readonly ["agent_servers"]` — top-level keys this repo owns.
- `ZedManagedContext` — `{ ompPath: string }`.
- `buildManagedZedSettings(ctx: ZedManagedContext): Record<ManagedZedKey, Record<string, unknown>>` — factory returning the canonical managed object.
- `mergeManagedZedSettings(existing: string, managed: ReturnType<typeof buildManagedZedSettings>): string` — pure, idempotent, comment-preserving, **throws `ZedSettingsParseError` on syntactically invalid JSONC**.
- `readZedAgentServer(text: string, name: string): unknown` — convenience reader, also throws on parse errors.
- `class ZedSettingsParseError extends Error` — exposes `.parseErrors` for diagnostics.

- [ ] **Step 1: Write the failing tests**

Create `tests/zed-settings.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import {
	buildManagedZedSettings,
	MANAGED_ZED_KEYS,
	mergeManagedZedSettings,
	readZedAgentServer,
	ZedSettingsParseError,
} from "../src/zed-settings.ts";

const FAKE_OMP = "/fake/path/to/omp";

const canonical = (ompPath = FAKE_OMP) =>
	buildManagedZedSettings({ ompPath });

const sampleSettings = `// Zed settings
{
  "agent_servers": {
    "claude-acp": { "type": "registry" }
  },
  "vim_mode": true
}
`;

describe("MANAGED_ZED_KEYS", () => {
	test("owns only agent_servers today", () => {
		expect(MANAGED_ZED_KEYS).toEqual(["agent_servers"]);
	});
});

describe("buildManagedZedSettings", () => {
	test("produces omp-acp custom entry pointing at the resolved binary", () => {
		expect(canonical("/abs/omp").agent_servers["omp-acp"]).toEqual({
			type: "custom",
			command: "/abs/omp",
			args: ["acp"],
		});
	});
});

describe("mergeManagedZedSettings", () => {
	test("adds omp-acp without touching claude-acp or unrelated keys", () => {
		const out = mergeManagedZedSettings(sampleSettings, canonical());
		expect(readZedAgentServer(out, "claude-acp")).toEqual({ type: "registry" });
		expect(readZedAgentServer(out, "omp-acp")).toEqual(canonical().agent_servers["omp-acp"]);
		expect(out).toContain("// Zed settings");
		expect(out).toContain('"vim_mode": true');
	});

	test("is byte-for-byte idempotent", () => {
		const once = mergeManagedZedSettings(sampleSettings, canonical());
		const twice = mergeManagedZedSettings(once, canonical());
		expect(twice).toBe(once);
	});

	test("overwrites a stale omp-acp entry to canonical shape", () => {
		const stale = `{
  "agent_servers": {
    "omp-acp": { "type": "custom", "command": "old-omp", "args": ["acp", "--bad"] }
  }
}
`;
		const out = mergeManagedZedSettings(stale, canonical());
		expect(readZedAgentServer(out, "omp-acp")).toEqual(canonical().agent_servers["omp-acp"]);
	});

	test("seeds an empty file with a valid managed document", () => {
		const out = mergeManagedZedSettings("", canonical());
		expect(readZedAgentServer(out, "omp-acp")).toEqual(canonical().agent_servers["omp-acp"]);
	});

	test("does not touch languages.CSharp (left to user)", () => {
		const withCsharpOverride = `{
  "languages": { "CSharp": { "language_servers": ["omnisharp", "!roslyn"] } }
}
`;
		const out = mergeManagedZedSettings(withCsharpOverride, canonical());
		expect(out).toContain('"omnisharp"');
		expect(out).toContain('"!roslyn"');
	});

	test("throws ZedSettingsParseError on syntactically invalid JSONC", () => {
		const broken = `{ "agent_servers": { "claude-acp": { type: "registry" } }`; // unquoted key + missing }
		expect(() => mergeManagedZedSettings(broken, canonical())).toThrow(ZedSettingsParseError);
	});
});

describe("readZedAgentServer", () => {
	test("returns undefined when entry is absent", () => {
		expect(readZedAgentServer(`{}`, "omp-acp")).toBeUndefined();
	});

	test("throws ZedSettingsParseError on invalid JSONC", () => {
		expect(() => readZedAgentServer(`{ broken`, "omp-acp")).toThrow(ZedSettingsParseError);
	});
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
bun test tests/zed-settings.test.ts
```

Expected: all 9 tests fail with `Cannot find module '../src/zed-settings.ts'`.

- [ ] **Step 3: Implement `src/zed-settings.ts`**

Create `src/zed-settings.ts`:

```typescript
import {
	applyEdits,
	findNodeAtLocation,
	getNodeValue,
	modify,
	type ParseError,
	parseTree,
	printParseErrorCode,
} from "jsonc-parser";

/**
 * Top-level Zed settings keys this repository owns. Everything else in the
 * user's `~/.config/zed/settings.json` — including `languages.CSharp`,
 * `theme`, `vim_mode`, panel placements — is preserved verbatim across merges.
 */
export const MANAGED_ZED_KEYS = ["agent_servers"] as const;

export type ManagedZedKey = (typeof MANAGED_ZED_KEYS)[number];

export interface ZedManagedContext {
	/** Absolute path to the `omp` binary (resolve at the boundary, never bake). */
	ompPath: string;
}

/**
 * Canonical managed values. `agent_servers["omp-acp"]` registers OMP as a
 * custom ACP server inside Zed (OMP is not in Zed's ACP Registry; the
 * registry's `pi` entry is upstream Pi, not OMP). `command` is an absolute
 * path because GUI-launched Zed cannot always be trusted to inherit the
 * shell's PATH on macOS.
 */
export function buildManagedZedSettings(
	ctx: ZedManagedContext,
): Record<ManagedZedKey, Record<string, unknown>> {
	return {
		agent_servers: {
			"omp-acp": {
				type: "custom",
				command: ctx.ompPath,
				args: ["acp"],
			},
		},
	};
}

export class ZedSettingsParseError extends Error {
	readonly parseErrors: readonly ParseError[];

	constructor(parseErrors: readonly ParseError[]) {
		const summary = parseErrors
			.slice(0, 3)
			.map(e => `${printParseErrorCode(e.error)} at offset ${e.offset}`)
			.join("; ");
		super(`Zed settings JSONC failed to parse: ${summary}`);
		this.name = "ZedSettingsParseError";
		this.parseErrors = parseErrors;
	}
}

const FORMATTING = { tabSize: 2, insertSpaces: true, eol: "\n" } as const;

/**
 * Merge managed Zed settings into existing JSONC text.
 *
 * Behavior contract:
 * - Throws `ZedSettingsParseError` on syntactically invalid JSONC.
 *   `jsonc-parser`'s `modify`/`parseTree` are fault-tolerant by design;
 *   we explicitly inspect the errors array and bail rather than rewrite
 *   a partially-parsed AST.
 * - Existing managed sub-keys are replaced in place with the canonical value.
 * - Missing managed sub-keys are added.
 * - Unmanaged keys (including unrelated entries inside `agent_servers`)
 *   and comments are preserved verbatim because edits are computed at
 *   character offsets, never via re-serialization.
 * - Applying the merge twice to its own output yields byte-equal text.
 * - Empty / whitespace-only input is seeded with `{}` first.
 */
export function mergeManagedZedSettings(
	existing: string,
	managed: Record<ManagedZedKey, Record<string, unknown>>,
): string {
	let text = existing.trim().length === 0 ? "{}\n" : existing;
	assertValidJsonc(text);
	for (const topKey of MANAGED_ZED_KEYS) {
		const desired = managed[topKey];
		for (const subKey of Object.keys(desired)) {
			const edits = modify(text, [topKey, subKey], desired[subKey], {
				formattingOptions: FORMATTING,
			});
			text = applyEdits(text, edits);
		}
	}
	return text;
}

/**
 * Read a single `agent_servers[name]` entry. Returns `undefined` if the
 * entry does not exist. Throws `ZedSettingsParseError` if the input is
 * not valid JSONC (so callers cannot mistake malformed user input for
 * "missing").
 */
export function readZedAgentServer(text: string, name: string): unknown {
	assertValidJsonc(text);
	const tree = parseTree(text);
	if (!tree) return undefined;
	const node = findNodeAtLocation(tree, ["agent_servers", name]);
	return node ? getNodeValue(node) : undefined;
}

function assertValidJsonc(text: string): void {
	const errors: ParseError[] = [];
	parseTree(text, errors);
	if (errors.length > 0) throw new ZedSettingsParseError(errors);
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
bun test tests/zed-settings.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/zed-settings.ts tests/zed-settings.test.ts
git commit -m "feat(zed): pure JSONC merger for managed Zed settings"
```

### Task 4: TDD `src/zed-settings-runtime.ts` — IO adapter

**Files:**
- Create: `src/zed-settings-runtime.ts`
- Modify: `tests/zed-settings.test.ts` (append runtime tests)

Repo precedent: `tests/runtime.test.ts` unit-tests `src/runtime.ts` against a temp directory. We do the same for `applyManagedZedSettings`.

- [ ] **Step 1: Append failing runtime tests**

Append to `tests/zed-settings.test.ts`:

```typescript
import { afterEach, beforeEach } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	applyManagedZedSettings,
	zedSettingsPath,
} from "../src/zed-settings-runtime.ts";

let runtimeHome: string;

beforeEach(async () => {
	runtimeHome = await mkdtemp(join(tmpdir(), "omp-zed-rt-"));
});

afterEach(async () => {
	await rm(runtimeHome, { recursive: true, force: true });
});

describe("zedSettingsPath", () => {
	test("resolves under ~/.config/zed/settings.json", () => {
		expect(zedSettingsPath(runtimeHome)).toBe(
			join(runtimeHome, ".config", "zed", "settings.json"),
		);
	});
});

describe("applyManagedZedSettings", () => {
	test("seeds a missing file with the managed omp-acp entry", async () => {
		const result = await applyManagedZedSettings({
			path: zedSettingsPath(runtimeHome),
			ompPath: "/fake/omp",
		});
		expect(result.existed).toBe(false);
		expect(result.changed).toBe(true);
		const text = await readFile(result.path, "utf8");
		expect(readZedAgentServer(text, "omp-acp")).toEqual({
			type: "custom",
			command: "/fake/omp",
			args: ["acp"],
		});
	});

	test("preserves unrelated keys and is idempotent", async () => {
		const target = zedSettingsPath(runtimeHome);
		await mkdir(join(runtimeHome, ".config", "zed"), { recursive: true });
		await writeFile(target, `// keep me\n{ "vim_mode": true }\n`);
		const first = await applyManagedZedSettings({ path: target, ompPath: "/fake/omp" });
		expect(first.changed).toBe(true);
		expect(await readFile(target, "utf8")).toContain("// keep me");
		const second = await applyManagedZedSettings({ path: target, ompPath: "/fake/omp" });
		expect(second.changed).toBe(false);
	});

	test("throws ZedSettingsParseError on malformed user input", async () => {
		const target = zedSettingsPath(runtimeHome);
		await mkdir(join(runtimeHome, ".config", "zed"), { recursive: true });
		await writeFile(target, `{ "agent_servers": { broken`);
		await expect(
			applyManagedZedSettings({ path: target, ompPath: "/fake/omp" }),
		).rejects.toThrow(ZedSettingsParseError);
	});
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
bun test tests/zed-settings.test.ts
```

Expected: the 4 new tests fail with `Cannot find module '../src/zed-settings-runtime.ts'`.

- [ ] **Step 3: Implement `src/zed-settings-runtime.ts`**

Create `src/zed-settings-runtime.ts`:

```typescript
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { buildManagedZedSettings, mergeManagedZedSettings } from "./zed-settings.ts";

/**
 * Zed settings path on macOS / Linux. Zed uses `~/.config/zed/settings.json`
 * on both platforms (macOS keeps DB/extension state under
 * `~/Library/Application Support/Zed/` but settings stay under `~/.config/zed/`).
 */
export function zedSettingsPath(home: string = homedir()): string {
	return join(home, ".config", "zed", "settings.json");
}

/**
 * Resolve the absolute path to the `omp` binary. We bake the absolute path
 * into the managed `command` field so GUI-launched Zed (which on macOS may
 * not inherit the shell's PATH reliably) can still find it.
 *
 * Returns `null` if `omp` is not on `$PATH`; the caller decides how to react.
 */
export function resolveOmpBinary(): string | null {
	return Bun.which("omp");
}

export interface ApplyManagedZedSettingsOptions {
	path?: string;
	ompPath: string;
}

export interface ZedMergeResult {
	path: string;
	existed: boolean;
	changed: boolean;
}

/**
 * Read the user's Zed settings, run the managed merge, write back only when
 * the content actually changed. Idempotent; safe to call on every bootstrap.
 *
 * Excluded from coverage threshold via the repo's standard `*-runtime.ts`
 * exclusion (see `AGENTS.md`). Behavior is exercised by both the unit tests
 * in `tests/zed-settings.test.ts` and the integration test in
 * `tests/integration/bootstrap.test.ts`.
 */
export async function applyManagedZedSettings(
	options: ApplyManagedZedSettingsOptions,
): Promise<ZedMergeResult> {
	const path = options.path ?? zedSettingsPath();
	let existing = "";
	let existed = true;
	try {
		existing = await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		existed = false;
	}
	const merged = mergeManagedZedSettings(
		existing,
		buildManagedZedSettings({ ompPath: options.ompPath }),
	);
	const changed = merged !== existing;
	if (changed) {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, merged);
	}
	return { path, existed, changed };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
bun test tests/zed-settings.test.ts
```

Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/zed-settings-runtime.ts tests/zed-settings.test.ts
git commit -m "feat(zed): runtime adapter for Zed settings merge"
```

### Task 5: Wire merge into bootstrap (test-first)

**Files:**
- Modify: `tests/integration/bootstrap.test.ts`
- Modify: `src/bootstrap.ts`

- [ ] **Step 1: Add the failing integration assertions**

Open `tests/integration/bootstrap.test.ts`. Add this import next to the existing `node:fs/promises` import (line 2):

```typescript
import { join } from "node:path"; // already present
```

(no change there — `mkdir`, `readFile`, `writeFile` are already imported).

Insert a new test right after the existing test at line 89 (the `"second run is idempotent"` block ends at line 101; insert before that one or after — see exact placement below). Add this test:

```typescript
	test("merges managed Zed settings under ~/.config/zed/settings.json", async () => {
		const zedPath = join(tempHome, ".config", "zed", "settings.json");
		await mkdir(join(tempHome, ".config", "zed"), { recursive: true });
		await writeFile(zedPath, `// user comment\n{ "vim_mode": true }\n`);

		const report = await runBootstrap({
			repoRoot,
			home: tempHome,
			skipPlugins: true,
			skipPatches: true,
		});
		expect(report.zedSettings.changed).toBe(true);
		expect(report.zedSettings.existed).toBe(true);

		const text = await readFile(zedPath, "utf8");
		expect(text).toContain("// user comment");
		expect(text).toContain('"vim_mode": true');
		expect(text).toContain('"omp-acp"');

		const second = await runBootstrap({
			repoRoot,
			home: tempHome,
			skipPlugins: true,
			skipPatches: true,
		});
		expect(second.zedSettings.changed).toBe(false);
	});
```

- [ ] **Step 2: Run the failing test**

```bash
bun test tests/integration/bootstrap.test.ts
```

Expected: the new test fails with `Cannot read properties of undefined (reading 'changed')` (because `report.zedSettings` does not exist yet).

- [ ] **Step 3: Add the import to `src/bootstrap.ts`**

Add to the import block near the other relative imports (after the `LOCAL_MANAGED_SKILLS` import around line 11):

```typescript
import { applyManagedZedSettings, resolveOmpBinary, zedSettingsPath } from "./zed-settings-runtime.ts";
```

- [ ] **Step 4: Extend `BootstrapReport`**

In `src/bootstrap.ts` (the `BootstrapReport` interface starts at line 48):

```typescript
export interface BootstrapReport {
	backupDir: string;
	snapshot: SnapshotPlan;
	links: LinkPlan;
	staleSymlinks: StaleSymlinkPlan;
	configChanged: boolean;
	pluginSteps: CheckoutStep[];
	patchExecutions: PatchExecution[];
	zedSettings: { path: string; existed: boolean; changed: boolean };
}
```

- [ ] **Step 5: Snapshot the Zed settings path**

In `runBootstrap`, find the `sourcesToSnapshot` array (line 72) and add `zedSettingsPath(home)` before `...patchTargets`:

```typescript
	const zedPath = zedSettingsPath(home);
	const sourcesToSnapshot = [
		join(agentDir, "config.yml"),
		join(agentDir, "AGENTS.md"),
		join(agentDir, "lsp.json"),
		join(extensionsDir, "superpowers-bootstrap.ts"),
		...LOCAL_MANAGED_SKILLS.map(skillName => join(agentDir, "skills", skillName)),
		join(home, ".omp", "plugins", "package.json"),
		join(home, ".omp", "plugins", "omp-plugins.lock.json"),
		zedPath,
		...patchTargets,
	];
```

- [ ] **Step 6: Run the merge after the YAML config merge**

Immediately after the existing `if (configChanged) { … }` block (around line 124), insert:

```typescript
	const ompPath = resolveOmpBinary();
	if (!ompPath) {
		throw new Error(
			"Cannot resolve `omp` binary on $PATH; install via `bun add -g @oh-my-pi/pi-coding-agent`.",
		);
	}
	const zedSettings = await applyManagedZedSettings({ path: zedPath, ompPath });
```

- [ ] **Step 7: Return `zedSettings` from `runBootstrap`**

Update the trailing `return { … };` to include `zedSettings`:

```typescript
	return {
		backupDir,
		snapshot,
		links,
		staleSymlinks,
		configChanged,
		pluginSteps,
		patchExecutions,
		zedSettings,
	};
```

- [ ] **Step 8: Extend `summarizeReport`**

Inside `summarizeReport` (starts at line 156), after the existing `lines.push(\`Config: …\`)` line, add:

```typescript
	lines.push(
		`Zed settings: ${report.zedSettings.changed ? "updated" : "unchanged"}${
			report.zedSettings.existed ? "" : " (created)"
		}`,
	);
```

- [ ] **Step 9: Run the integration test and confirm it passes**

```bash
bun test tests/integration/bootstrap.test.ts
```

Expected: pass, including the new test and the existing "second run is idempotent" test (which now also exercises Zed settings idempotency).

- [ ] **Step 10: Commit**

```bash
git add src/bootstrap.ts tests/integration/bootstrap.test.ts
git commit -m "feat(bootstrap): merge managed Zed settings during bootstrap"
```

### Task 6: TDD doctor check with canonical deep-equal

**Files:**
- Modify: `tests/cli.test.ts`
- Modify: `src/cli.ts`

The doctor check compares the parsed `omp-acp` value against `buildManagedZedSettings({ ompPath }).agent_servers["omp-acp"]` via Bun's `Bun.deepEquals`. This catches drift (extra args, wrong type, wrong command) that a per-field predicate would miss.

- [ ] **Step 1: Write failing tests**

Add to `tests/cli.test.ts` (after the existing `describe` block):

```typescript
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { checkZedSettings } from "../src/cli.ts";

describe("checkZedSettings", () => {
	let home: string;
	const FAKE_OMP = "/fake/omp";

	beforeEach(async () => {
		home = await mkdtemp(join(tmpdir(), "omp-zed-cli-"));
		await mkdir(join(home, ".config", "zed"), { recursive: true });
	});

	afterEach(async () => {
		await rm(home, { recursive: true, force: true });
	});

	test("reports missing when settings.json absent", async () => {
		const line = await checkZedSettings({ home, ompPath: FAKE_OMP });
		expect(line).toMatch(/^Zed settings: missing/);
	});

	test("reports ok when omp-acp matches canonical", async () => {
		await writeFile(
			join(home, ".config", "zed", "settings.json"),
			`{ "agent_servers": { "omp-acp": { "type": "custom", "command": "/fake/omp", "args": ["acp"] } } }\n`,
		);
		const line = await checkZedSettings({ home, ompPath: FAKE_OMP });
		expect(line).toMatch(/^Zed settings: ok/);
	});

	test("reports drift when omp-acp args differ", async () => {
		await writeFile(
			join(home, ".config", "zed", "settings.json"),
			`{ "agent_servers": { "omp-acp": { "type": "custom", "command": "/fake/omp", "args": ["acp", "--extra"] } } }\n`,
		);
		const line = await checkZedSettings({ home, ompPath: FAKE_OMP });
		expect(line).toMatch(/^Zed settings: drift/);
	});

	test("reports parse error when settings.json is malformed", async () => {
		await writeFile(join(home, ".config", "zed", "settings.json"), `{ broken`);
		const line = await checkZedSettings({ home, ompPath: FAKE_OMP });
		expect(line).toMatch(/^Zed settings: parse error/);
	});
});
```

Also import `beforeEach`, `afterEach` from `bun:test` at the top of the file.

- [ ] **Step 2: Run tests and confirm they fail**

```bash
bun test tests/cli.test.ts
```

Expected: the 4 new tests fail with `Cannot find name 'checkZedSettings'` (export missing).

- [ ] **Step 3: Implement `checkZedSettings` in `src/cli.ts`**

Add these imports near the top of `src/cli.ts`:

```typescript
import { readFile } from "node:fs/promises";
import {
	buildManagedZedSettings,
	readZedAgentServer,
	ZedSettingsParseError,
} from "./zed-settings.ts";
import { zedSettingsPath } from "./zed-settings-runtime.ts";
```

Add the exported helper near `managedAgentChecks` (around line 183):

```typescript
export interface CheckZedSettingsOptions {
	home: string;
	ompPath: string;
}

export async function checkZedSettings(
	options: CheckZedSettingsOptions,
): Promise<string> {
	const path = zedSettingsPath(options.home);
	let text: string;
	try {
		text = await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return `Zed settings: missing at ${path}`;
		}
		throw error;
	}
	let entry: unknown;
	try {
		entry = readZedAgentServer(text, "omp-acp");
	} catch (error) {
		if (error instanceof ZedSettingsParseError) {
			return `Zed settings: parse error at ${path} (${error.message})`;
		}
		throw error;
	}
	const canonical = buildManagedZedSettings({ ompPath: options.ompPath })
		.agent_servers["omp-acp"];
	if (entry === undefined) {
		return `Zed settings: missing omp-acp entry (${path})`;
	}
	if (!Bun.deepEquals(entry, canonical)) {
		return `Zed settings: drift in omp-acp entry (${path})`;
	}
	return `Zed settings: ok (${path})`;
}
```

- [ ] **Step 4: Wire `checkZedSettings` into `cmdDoctor`**

Locate `cmdDoctor` in `src/cli.ts` (starts at line 140). After the for-loop over `manifest.plugins` (line 172) and before `if (issues > 0)` (line 173), add:

```typescript
	const ompForDoctor = resolveOmpBinary();
	if (!ompForDoctor) {
		console.log("  WARN Zed settings: cannot resolve omp on $PATH");
		issues++;
	} else {
		const zedLine = await checkZedSettings({ home, ompPath: ompForDoctor });
		if (zedLine.startsWith("Zed settings: ok")) {
			console.log(`  ok   ${zedLine}`);
		} else {
			console.log(`  WARN ${zedLine}`);
			issues++;
		}
	}
```

Also add `resolveOmpBinary` to the existing `zed-settings-runtime.ts` import:

```typescript
import { resolveOmpBinary, zedSettingsPath } from "./zed-settings-runtime.ts";
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
bun test tests/cli.test.ts
```

Expected: all tests pass (including the existing 3 and the new 4).

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "feat(doctor): report Zed managed settings status with canonical drift check"
```

---

## Phase 2: Apply the managed Zed settings

### Task 7: Run bootstrap and verify Zed picks up omp-acp

**Files:**
- Run: `bun run bootstrap`
- Verify: `~/.config/zed/settings.json`

Zed live-reloads `settings.json` for regular files (this user's file is regular, not a symlink), so a restart is not required for the change to take effect — restart steps below are purely for UX validation.

- [ ] **Step 1: Run bootstrap**

```bash
bun run bootstrap
```

Expected line in summary:

```
Zed settings: updated
```

- [ ] **Step 2: Inspect the merged file**

```bash
cat "$HOME/.config/zed/settings.json"
```

Expected:
- Existing `claude-acp` and `codex-acp` entries intact.
- New `"omp-acp": { "type": "custom", "command": "/Users/joaichberger/.bun/bin/omp", "args": ["acp"] }` added to `agent_servers`.
- `languages.CSharp` left unchanged (we don't manage it; Task 8 handles it manually).
- Comments and user keys (`vim_mode`, `theme`, panel placements) preserved verbatim.

- [ ] **Step 3: Confirm `bun run doctor` reports it healthy**

```bash
bun run doctor
```

Expected: a line like `  ok   Zed settings: ok (/Users/joaichberger/.config/zed/settings.json)`.

- [ ] **Step 4: Smoke test in Zed**

```bash
osascript -e 'tell application "Zed" to quit' 2>/dev/null || true
sleep 2
open -a Zed
```

Then in Zed: open the Agent panel, click the agent picker, confirm `omp-acp` is listed alongside `claude-acp` and `codex-acp`. Send a one-line prompt (e.g. `read AGENTS.md`). Confirm:

- The tool call renders as a Zed card (a permission prompt may appear; allow once).
- The file content comes back in the panel.
- `~/Library/Logs/Zed/Zed.log` has no errors mentioning `omp-acp`.

- [ ] **Step 5: Idempotency check**

```bash
bun run bootstrap
```

Expected: `Zed settings: unchanged`.

- [ ] **Step 6: No commit (runtime verification only)**

Skip.

### Task 8: Remove the broken `languages.CSharp` override

**Files:**
- Modify: `~/.config/zed/settings.json` (user-owned, manual edit)

This is a one-time hand edit, not managed. We do not own `languages.CSharp` because the desired state is "absent" — easier to do as a one-time deletion than to model as a managed sentinel.

- [ ] **Step 1: Quit Zed**

```bash
osascript -e 'tell application "Zed" to quit' 2>/dev/null || true
sleep 2
```

- [ ] **Step 2: Confirm the Zed `csharp` extension is installed**

Zed's C# support comes from the separate `csharp` extension. Auto-install fires only for extensions listed in `auto_install_extensions`; deleting the `languages.CSharp` override does not on its own install the extension.

```bash
ls "$HOME/Library/Application Support/Zed/extensions/installed/" 2>/dev/null | grep -i csharp || echo "csharp extension NOT installed"
```

If the output says "NOT installed":
1. Reopen Zed.
2. Open the command palette (`Cmd+Shift+P`) → `zed: extensions`.
3. Search for `C#` → install the official `C#` extension.
4. Quit Zed again.

- [ ] **Step 3: Remove the `languages` block from `~/.config/zed/settings.json`**

Open `~/.config/zed/settings.json` and delete the entire `languages: { CSharp: { language_servers: ["omnisharp", "!roslyn"] } }` block (currently lines 51–55). Fix any trailing-comma syntax that becomes invalid after the deletion.

- [ ] **Step 4: Reopen Zed and open a C# file from any project that has one**

Zed will auto-install Roslyn under `~/Library/Application Support/Zed/extensions/work/csharp/` on first C# open. Wait ~30s.

```bash
ls "$HOME/Library/Application Support/Zed/extensions/work/csharp/" 2>/dev/null
```

Expected: a `roslyn-*` directory appears.

- [ ] **Step 5: Confirm log is clean**

```bash
tail -n 60 "$HOME/Library/Logs/Zed/Zed.log"
```

Expected: no `Get document highlights via omnisharp failed: server shut down` lines after the timestamp Zed restarted.

- [ ] **Step 6: Fallback ladder if Roslyn misbehaves**

Background: [Zed #55746](https://github.com/zed-industries/zed/issues/55746). Per [maintainer @probably-neb's 2026-05-15 comment](https://github.com/zed-industries/zed/issues/55746#issuecomment-…), one half of the watcher storm is fixed in latest stable; the other half is still being worked on.

If Zed CPU spikes >50% after opening a C# file, try in this order:

1. **Update Zed.** `Zed → Update Zed` (or restart to pick up an auto-update). Confirm you're on the latest stable.
2. **Disable C# LSP temporarily.** If you don't need C# IntelliSense right now, add to `~/.config/zed/settings.json`:
   ```json
   "languages": { "CSharp": { "enable_language_server": false } }
   ```
   This is per [@gabriel-ecegi's reproducible workaround on #55746](https://github.com/zed-industries/zed/issues/55746#issuecomment-…) and stops the watcher churn cold.
3. **Temporarily fall back to OmniSharp.** OmniSharp is not deprecated; it's a valid contingency if you need C# LSP and Roslyn still hits the bug. Install via:
   ```bash
   # Apple Silicon: per #8352, the runtime path issue is resolved upstream.
   # Zed's C# extension will install OmniSharp on first C# open when forced.
   ```
   then set:
   ```json
   "languages": { "CSharp": { "language_servers": ["omnisharp", "!roslyn"] } }
   ```
   Treat this as a temporary state. Revisit when #55746 fully closes.

- [ ] **Step 7: No commit (user-owned file)**

Skip.

---

## Phase 3: Documentation

### Task 9: Document Zed surface in deployed `agent/AGENTS.md`

**Files:**
- Modify: `agent/AGENTS.md`

- [ ] **Step 1: Add an "Editor surface" section after "Methodology"**

Insert between the "Methodology" paragraph and the "Conventions and recovery" section:

```markdown
## Editor surface: Zed (ACP)

OMP runs inside Zed via the [Agent Client Protocol](https://github.com/zed-industries/agent-client-protocol) (`omp acp`). When invoked from Zed's Agent panel, tool I/O routes through the editor: `read`/`write` go through Zed's buffer and save pipeline (so unsaved changes are visible to OMP, and writes hit Zed's formatter and undo history), `bash` calls render as Zed terminals, and destructive tools (`edit`, `ast_edit`, `write`, `bash`) gate via `session/request_permission` with an "allow always" option. LSP, DAP, and subagent fan-out stay inside OMP; ACP only bridges the editor-visible surface, so the agent and the IDE can independently disagree on, e.g., C# analyzer diagnostics (csharp-ls defaults `analyzersEnabled: false`).

The agent server is registered in `~/.config/zed/settings.json` under `agent_servers["omp-acp"]` by `omp-agent-setup`'s `bun run bootstrap`. C# LSP is intentionally split: Zed uses Roslyn (its default) for interactive editing; OMP uses csharp-ls for headless tool calls. Don't force parity.
```

- [ ] **Step 2: Verify the deployed symlink picks up the change**

`agent/AGENTS.md` is symlinked into `~/.omp/agent/AGENTS.md`, so the edit is live immediately:

```bash
grep -c "Editor surface: Zed" "$HOME/.omp/agent/AGENTS.md"
```

Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add agent/AGENTS.md
git commit -m "docs(agent): document Zed ACP surface for agents-in-Zed"
```

### Task 10: Document Zed integration in repo `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add a row to the "Boundaries" table**

After the existing "Add an `lsp.json` to a user project" row, add:

```markdown
|Hand-edit `~/.config/zed/settings.json` for managed keys (`agent_servers.omp-acp`)|Change the source in `src/zed-settings.ts` (`MANAGED_ZED_KEYS` + `buildManagedZedSettings`), then `bun run bootstrap`. Other keys (`languages`, `theme`, panel placements) are user-owned and ignored by the merge.|
```

- [ ] **Step 2: Add a "Zed integration" subsection after "LSP maintenance"**

```markdown
## Zed integration

Zed runs OMP via ACP (`omp acp`); the entry under `agent_servers["omp-acp"]` is owned by this repo and merged into `~/.config/zed/settings.json` by `bun run bootstrap`. The merger (`src/zed-settings.ts`) edits JSONC at character offsets via `jsonc-parser` (`modify` / `applyEdits` for writes, `findNodeAtLocation` + `getNodeValue` for reads, `parseTree(text, errors)` to fail closed on syntactically-broken user input). Comments and unrelated keys are preserved. The merged path is snapshotted to `backups/<UTC>/` on every bootstrap.

The `omp` binary path written into the managed entry is resolved at bootstrap time via `Bun.which("omp")`, not baked into source — GUI-launched Zed on macOS does not always inherit the shell's PATH, so absolute paths are safer.

C# LSP is split intentionally: Zed → Roslyn (its default, ships via the `csharp` Zed extension), OMP → csharp-ls (via `agent/lsp.json`). Roslyn is Zed's actively-maintained first-party C# server; csharp-ls is sufficient for headless `lsp` ops and avoids the third-party-extension footprint inside Zed. Known asymmetries: csharp-ls disables analyzers by default and source-generator support is in-progress; Razor/CSHTML is not supported in either path today (Zed C# extension #41). Don't try to force parity.

OmniSharp remains a documented contingency for when [Zed #55746](https://github.com/zed-industries/zed/issues/55746) bites and a working C# LSP is urgent. It is not deprecated (latest release 1.39.15 in 2025-11) but it is not the steady state either.

If a new Zed key needs to be managed, add it to `MANAGED_ZED_KEYS` and extend `buildManagedZedSettings` in `src/zed-settings.ts`, then add a test in `tests/zed-settings.test.ts`.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document Zed integration boundaries"
```

### Task 11: Document Zed in `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a row to the "What gets deployed" table**

After the `manifests/plugins.yml` row, add:

```markdown
| managed keys in `src/zed-settings.ts` | `~/.config/zed/settings.json` | merged JSONC (via `jsonc-parser`), unrelated keys and comments preserved; managed entry uses absolute `omp` path resolved at bootstrap time |
```

- [ ] **Step 2: Add a "Zed integration" section after "LSP"**

```markdown
## Zed integration

OMP runs inside Zed via the [Agent Client Protocol](https://github.com/zed-industries/agent-client-protocol). `bun run bootstrap` registers `omp-acp` as a custom `agent_servers` entry in `~/.config/zed/settings.json` (`{ "type": "custom", "command": "<absolute omp path>", "args": ["acp"] }`); everything else is untouched. From Zed's Agent panel you get the same OMP you drive from the TUI — reading the buffer Zed sees, writing through Zed's save pipeline, opening shells in Zed's terminal. Permission prompts gate destructive tools; "allow always" persists per project.

C# LSP is intentionally split. Zed uses Roslyn (its built-in default, via the `csharp` Zed extension); OMP uses csharp-ls (via `agent/lsp.json`). Roslyn is the actively-maintained first-party Zed C# server; csharp-ls is enough for the headless `lsp` ops the agent runs. The asymmetry is recorded: csharp-ls defaults analyzer-backed diagnostics off, source-generator support is upstream-WIP, and neither path supports Razor/CSHTML in Zed today ([extension #41](https://github.com/zed-extensions/csharp/issues/41)). Forcing parity would require shipping a third-party Zed extension for csharp-ls; not worth it.

OmniSharp is a documented contingency, not the steady state — see `AGENTS.md`.

The OMP ↔ Zed bridge only covers editor-visible I/O (`fs/read_text_file`, `fs/write_text_file`, `terminal/*`, `session/request_permission`). OMP's own LSP, DAP, subagent fan-out, and tool implementations all stay inside OMP — Zed does not host the agent's brain.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): document Zed integration and C# LSP split"
```

---

## Phase 4: Verification

### Task 12: Full CI gate

- [ ] **Step 1: Run full CI**

```bash
bun run ci
```

Expected: `check:lint`, `check:types`, `check:dead`, `check:audit`, `check:test` all pass.

- [ ] **Step 2: Run live verify**

```bash
OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify
```

Expected: pass.

- [ ] **Step 3: Confirm doctor reports the new managed surface**

```bash
bun run doctor
```

Expected: a line `  ok   Zed settings: ok (/Users/joaichberger/.config/zed/settings.json)`.

- [ ] **Step 4: Manual Zed log re-check**

After at least one Zed open/close cycle since Phase 0 + Phase 2:

```bash
tail -n 100 "$HOME/Library/Logs/Zed/Zed.log"
```

Expected:
- No `worktree root <X> no longer exists` lines.
- No `omnisharp failed: server shut down` lines.
- No `Failed to spawn` for json-language-server / package-version-server in missing dirs.
- eslint timeouts may still appear if you opened the heavy project; out of scope.

---

## Self-review

Honest checklist after the post-review rewrite.

**Spec coverage:**
- ✅ Stale single-file worktrees: Phase 0, FK-aware deletes covering 3 `editors` + 1 `editor_selections` + optional `vim_marks`.
- ✅ omnisharp shutdown spam: Phase 2 / Task 8, with multi-tier fallback ladder.
- ✅ eslint timeouts: explicitly out of scope, documented as such.
- ✅ OMP-in-Zed via ACP: Phase 1 infrastructure + Phase 2 application + Task 11 docs.
- ✅ Repo changes reflecting Zed integration: Phase 3 across `agent/AGENTS.md`, `AGENTS.md`, `README.md`.
- ✅ Long-term: introduces a managed Zed-settings surface mirroring the existing managed-YAML pattern; idempotent; reversible via snapshot; absolute paths via `Bun.which`.
- ✅ C# split recorded with honest trade-offs (no Razor claim, OmniSharp contingency, csharp-ls capability gaps).

**Placeholder scan:** none. Every code block, SQL block, and JSON snippet is concrete. The two prior offenders are fixed:
- Task 5 now references exact line numbers (line 2 import, line 48 interface, line 72 sourcesToSnapshot, line 124 merge invocation, line 156 summarizeReport).
- Task 6 has full test code rather than "mirror the shape".

**Type consistency:**
- `MANAGED_ZED_KEYS` (single name, no `MANAGED_ZED_PATHS` ghost).
- `buildManagedZedSettings(ctx)` / `mergeManagedZedSettings(existing, managed)` / `readZedAgentServer(text, name)` / `ZedSettingsParseError` consistent across all referencing tasks.
- `applyManagedZedSettings({ path, ompPath })` / `zedSettingsPath(home)` / `resolveOmpBinary()` consistent.
- `BootstrapReport.zedSettings: { path; existed; changed }` defined in Task 5 Step 4, consumed in Task 5 Step 8 and Task 12 Step 3.
- `checkZedSettings({ home, ompPath })` consistent between Task 6 test and implementation.

**TDD discipline:**
- Task 3 (zed-settings.ts): tests first → red → impl → green → commit. ✅
- Task 4 (runtime.ts): tests first → red → impl → green → commit. ✅
- Task 5 (bootstrap wiring): integration test first → red → impl across 7 surgical steps → green → commit. ✅
- Task 6 (doctor): tests first → red → impl → green → commit. ✅
- Documentation tasks (9–11) don't have tests; commit-per-task instead.

**Task granularity:**
- Task 5 is the heaviest — 10 steps. Each step is a single edit at a known line range (import, interface, array, return, summarize, run, commit), explicitly decomposed per reviewer feedback.
- Other tasks fit the 2–5 minute rule comfortably.

**Known scope omissions (intentional):**
- We do not manage `languages.CSharp` — desired state is "absent", cleanly done as a manual one-time deletion (Task 8) rather than a managed sentinel.
- We do not ship a Zed C# csharp-ls extension. Documented in `AGENTS.md` and `README.md`.
- We do not raise the eslint LSP timeout. That belongs in the affected project's `.zed/settings.json`, not in a global override.
- We do not add Zed itself or the `csharp` Zed extension to a managed inventory. Both are user-installed via the Zed UI; the plan walks through it in Task 8 Step 2.
