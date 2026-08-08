import { describe, expect, test } from "bun:test";
import {
	parseUpdateVendoredSkillArgs,
	selectSubtreeFiles,
	type TreeEntry,
} from "../src/vendored-skill-update.ts";

describe("selectSubtreeFiles", () => {
	const entries: TreeEntry[] = [
		{ path: "README.md", type: "blob" },
		{ path: "skills/simple-english", type: "tree" },
		{ path: "skills/simple-english/SKILL.md", type: "blob" },
		{ path: "skills/simple-english/references", type: "tree" },
		{ path: "skills/simple-english/references/checklist.md", type: "blob" },
		// A sibling whose name merely starts with the prefix must not be vendored.
		{ path: "skills/simple-english-extra/x.md", type: "blob" },
		{ path: "skills/other/SKILL.md", type: "blob" },
	];

	test("keeps only blobs under the prefix, relative to it", () => {
		expect(selectSubtreeFiles(entries, "skills/simple-english")).toEqual([
			"SKILL.md",
			"references/checklist.md",
		]);
	});

	test("tolerates a trailing slash on the source dir", () => {
		expect(selectSubtreeFiles(entries, "skills/simple-english/")).toEqual([
			"SKILL.md",
			"references/checklist.md",
		]);
	});

	test("returns nothing when the prefix is absent", () => {
		expect(selectSubtreeFiles(entries, "skills/nonesuch")).toEqual([]);
	});

	test("refuses a path that escapes the subtree", () => {
		expect(() =>
			selectSubtreeFiles(
				[{ path: "skills/simple-english/../evil.md", type: "blob" }],
				"skills/simple-english",
			),
		).toThrow(/refusing path with '\.\.' segment/);
	});
});

describe("parseUpdateVendoredSkillArgs", () => {
	test("accepts exactly one name", () => {
		expect(parseUpdateVendoredSkillArgs(["simple-english"])).toEqual({
			kind: "run",
			name: "simple-english",
		});
	});

	test("accepts help flags", () => {
		expect(parseUpdateVendoredSkillArgs(["--help"])).toEqual({ kind: "help" });
		expect(parseUpdateVendoredSkillArgs(["-h"])).toEqual({ kind: "help" });
	});

	test("rejects zero and multiple names", () => {
		expect(parseUpdateVendoredSkillArgs([])).toEqual({
			kind: "error",
			message: "usage: bun run update-vendored-skill <name>",
		});
		expect(parseUpdateVendoredSkillArgs(["a", "b"]).kind).toBe("error");
	});
});
