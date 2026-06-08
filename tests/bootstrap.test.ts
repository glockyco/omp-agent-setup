import { describe, expect, test } from "bun:test";
import { unhealthyPatchExecutions } from "../src/bootstrap.ts";
import type { Patch } from "../src/patches.ts";
import type { PatchExecution } from "../src/patches-runtime.ts";

const patch: Patch = {
	id: "sample",
	package: "pi-ai",
	targetRelative: "src/sample.ts",
	description: "sample patch",
	anchor: "old",
	replacement: "new",
	appliedSignature: "new",
};

const apply: PatchExecution = { kind: "apply", patch, targetPath: "/x/sample.ts" };
const alreadyApplied: PatchExecution = {
	kind: "skip-already-applied",
	patch,
	targetPath: "/x/sample.ts",
};
const anchorMissing: PatchExecution = {
	kind: "skip-anchor-missing",
	patch,
	targetPath: "/x/sample.ts",
};
const targetMissing: PatchExecution = {
	kind: "skip-target-missing",
	patch,
	targetPath: "/x/sample.ts",
};

describe("unhealthyPatchExecutions", () => {
	test("treats apply and already-applied as healthy", () => {
		expect(unhealthyPatchExecutions([apply, alreadyApplied])).toEqual([]);
	});

	test("surfaces drift and missing-target executions, preserving order", () => {
		const result = unhealthyPatchExecutions([apply, anchorMissing, alreadyApplied, targetMissing]);
		expect(result).toEqual([anchorMissing, targetMissing]);
	});
});
