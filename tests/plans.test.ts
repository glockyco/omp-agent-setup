import { expect, test } from "bun:test";
import {
	classifyDoc,
	countTasks,
	DEFAULT_THRESHOLDS,
	type DocRow,
	parseDoc,
	parseThresholds,
	pickLastTouched,
	renderIndex,
	renderStatus,
	validateDoc,
	validateLinks,
} from "../src/plans.ts";

test("parseDoc extracts front-matter and body", () => {
	const doc = parseDoc(
		"a.md",
		"---\ntitle: A\ntype: plan\nstatus: active\ncreated: 2026-06-23\n---\n# A\n- [x] one\n",
	);
	expect(doc.frontMatter.type).toBe("plan");
	expect(doc.frontMatter.status).toBe("active");
	expect(doc.body).toContain("# A");
	expect(doc.slug).toBe("a");
});

test("parseDoc tolerates missing front-matter", () => {
	const doc = parseDoc("b.md", "# no fm\n");
	expect(doc.frontMatter).toEqual({});
	expect(doc.body).toContain("# no fm");
});

test("validateDoc rejects bad type/status and missing required keys", () => {
	const badType = parseDoc(
		"b.md",
		"---\ntitle: B\ntype: bogus\nstatus: active\ncreated: 2026-06-23\n---\n",
	);
	expect(validateDoc(badType).map(e => e.code)).toContain("bad-type");
	const noStatus = parseDoc("c.md", "---\ntitle: C\ntype: plan\ncreated: 2026-06-23\n---\n");
	expect(validateDoc(noStatus).map(e => e.code)).toContain("missing-status");
	const superseded = parseDoc(
		"d.md",
		"---\ntitle: D\ntype: plan\nstatus: superseded\ncreated: 2026-06-23\n---\n",
	);
	expect(validateDoc(superseded).map(e => e.code)).toContain("missing-superseded_by");
});

test("validateDoc passes a well-formed doc", () => {
	const ok = parseDoc(
		"e.md",
		"---\ntitle: E\ntype: spec\nstatus: draft\ncreated: 2026-06-23\n---\n",
	);
	expect(validateDoc(ok)).toEqual([]);
});

test("countTasks scopes to task sections and ignores code fences", () => {
	const body = [
		"Intro",
		"- [ ] not a task (no section)",
		"## Tasks",
		"- [x] done",
		"- [ ] todo",
		"```",
		"- [ ] fenced example",
		"```",
		"### Task 5: thing",
		"- [X] sub",
	].join("\n");
	expect(countTasks(body)).toEqual({ done: 2, total: 3 });
});

test("countTasks returns zero when there are no task sections", () => {
	expect(countTasks("# x\n- [ ] loose\n")).toEqual({ done: 0, total: 0 });
});

const now = new Date("2026-06-23T00:00:00Z");

test("classifyDoc flags stale-active, complete, and deletable-archive", () => {
	const stale = classifyDoc(
		{
			status: "active",
			lastTouched: new Date("2026-01-01"),
			tasks: { done: 1, total: 3 },
			archived: null,
		},
		now,
	);
	expect(stale.flags).toContain("stale");
	const complete = classifyDoc(
		{ status: "active", lastTouched: now, tasks: { done: 3, total: 3 }, archived: null },
		now,
	);
	expect(complete.flags).toContain("complete");
	const deletable = classifyDoc(
		{
			status: "superseded",
			lastTouched: now,
			tasks: { done: 0, total: 0 },
			archived: new Date("2025-01-01"),
		},
		now,
	);
	expect(deletable.flags).toContain("deletable");
});

test("classifyDoc does not flag a fresh, incomplete active doc", () => {
	const fresh = classifyDoc(
		{ status: "active", lastTouched: now, tasks: { done: 1, total: 3 }, archived: null },
		now,
	);
	expect(fresh.flags).toEqual([]);
});

test("validateLinks flags dangling parent/superseded_by", () => {
	const docs = [
		parseDoc(
			"a.md",
			"---\ntitle: A\ntype: plan\nstatus: active\ncreated: 2026-06-23\nparent: ghost\n---\n",
		),
	];
	expect(validateLinks(docs).map(e => e.code)).toContain("dangling-parent");
});

test("validateLinks accepts resolvable links", () => {
	const docs = [
		parseDoc("umbrella.md", "---\ntitle: U\ntype: spec\nstatus: active\ncreated: 2026-06-23\n---\n"),
		parseDoc(
			"child.md",
			"---\ntitle: C\ntype: plan\nstatus: active\ncreated: 2026-06-23\nparent: umbrella\n---\n",
		),
	];
	expect(validateLinks(docs)).toEqual([]);
});

function makeRow(over: Partial<DocRow> & { slug: string }): DocRow {
	return {
		frontMatter: {},
		lastTouched: null,
		tasks: { done: 0, total: 0 },
		archived: null,
		flags: [],
		...over,
	};
}

test("renderIndex groups by status, blank-separates sections, excludes archive", () => {
	const out = renderIndex([
		makeRow({
			slug: "p1",
			frontMatter: { title: "P1", type: "plan", status: "active" },
			tasks: { done: 1, total: 2 },
			lastTouched: new Date("2026-06-22T00:00:00Z"),
		}),
		makeRow({
			slug: "d1",
			frontMatter: { title: "D1", type: "spec", status: "draft" },
		}),
		makeRow({
			slug: "old",
			frontMatter: { title: "Old", type: "plan", status: "implemented" },
			archived: new Date("2026-01-01"),
		}),
	]);
	expect(out).toContain("## active");
	expect(out).toContain("`p1`");
	expect(out).toContain("(1/2)");
	expect(out).not.toContain("`old`");
	expect(out).not.toContain("2026-06-22");
	expect(out).toContain("1 archived");
	expect(out).toContain("\n\n## draft");
	expect(out).not.toMatch(/[^\n]\n## /);
});

test("renderStatus --json carries completion and flags", () => {
	const out = renderStatus(
		[
			makeRow({
				slug: "p1",
				frontMatter: { type: "plan", status: "active" },
				tasks: { done: 2, total: 2 },
				flags: ["complete"],
			}),
		],
		{ json: true },
	);
	const parsed = JSON.parse(out) as Array<{
		completion: { done: number; total: number };
		flags: string[];
	}>;
	expect(parsed[0]?.completion).toEqual({ done: 2, total: 2 });
	expect(parsed[0]?.flags).toContain("complete");
});

test("renderStatus table includes status, ratio, slug, and flags", () => {
	const out = renderStatus([
		makeRow({
			slug: "p1",
			frontMatter: { type: "plan", status: "active" },
			tasks: { done: 1, total: 2 },
			lastTouched: now,
			flags: ["stale"],
		}),
	]);
	expect(out).toContain("active");
	expect(out).toContain("1/2");
	expect(out).toContain("p1");
	expect(out).toContain("[stale]");
});

test("pickLastTouched skips [docs-skip] commits", () => {
	const log = ["2026-06-20T00:00:00Z\x1ftypo [docs-skip]", "2026-06-10T00:00:00Z\x1freal work"].join(
		"\n",
	);
	expect(pickLastTouched(log)?.toISOString().slice(0, 10)).toBe("2026-06-10");
});

test("pickLastTouched returns null on an empty log", () => {
	expect(pickLastTouched("")).toBeNull();
});

test("parseThresholds overrides defaults from toml, else keeps base", () => {
	expect(parseThresholds("stale_days = 30\narchive_delete_days = 90\n", DEFAULT_THRESHOLDS)).toEqual(
		{ staleDays: 30, archiveDeleteDays: 90 },
	);
	expect(parseThresholds("", DEFAULT_THRESHOLDS)).toEqual(DEFAULT_THRESHOLDS);
});

test("parseDoc captures invalid YAML; validateDoc reports bad-frontmatter (not a crash)", () => {
	const doc = parseDoc("bad.md", "---\ntitle: PRD: oops\n---\n# x\n");
	expect(doc.parseError).toBeTruthy();
	expect(validateDoc(doc).map(e => e.code)).toEqual(["bad-frontmatter"]);
});
