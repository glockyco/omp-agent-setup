import { describe, expect, test } from "bun:test";
import {
	type BootstrapReport,
	summarizeReport,
	unhealthyPatchExecutions,
	unhealthyPluginSteps,
} from "../src/bootstrap.ts";
import type { Patch } from "../src/patches.ts";
import type { PatchExecution } from "../src/patches-runtime.ts";
import type { CheckoutStep, PluginSpec } from "../src/plugins.ts";

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

const plugin: PluginSpec = {
	name: "plannotator",
	path: "~/Projects/plannotator",
	pathExpanded: "/home/user/Projects/plannotator",
	upstream: "https://example.invalid/upstream.git",
	fork: "https://example.invalid/fork.git",
	branch: "omp-local",
};

const branchMissing: CheckoutStep = { kind: "branch-missing", plugin, branch: "omp-local" };
const checkoutBranch: CheckoutStep = {
	kind: "checkout-branch",
	plugin,
	branch: "omp-local",
	source: "local",
};

function reportWith(pluginSteps: CheckoutStep[]): BootstrapReport {
	return {
		backupDir: "/x/backups/run1",
		snapshot: { backupDir: "/x/backups/run1", entries: [] },
		links: { entries: [] },
		removedSymlinks: { entries: [] },
		configChanged: false,
		mcpConfigChanged: false,
		pluginSteps,
		patchExecutions: [],
	};
}

describe("unhealthyPatchExecutions", () => {
	test("treats apply and already-applied as healthy", () => {
		expect(unhealthyPatchExecutions([apply, alreadyApplied])).toEqual([]);
	});

	test("surfaces drift and missing-target executions, preserving order", () => {
		const result = unhealthyPatchExecutions([apply, anchorMissing, alreadyApplied, targetMissing]);
		expect(result).toEqual([anchorMissing, targetMissing]);
	});
});

describe("unhealthyPluginSteps", () => {
	test("selects only branch-missing steps", () => {
		expect(unhealthyPluginSteps([checkoutBranch, branchMissing])).toEqual([branchMissing]);
	});

	test("treats an ordinary checkout as healthy", () => {
		expect(unhealthyPluginSteps([checkoutBranch])).toEqual([]);
	});
});

describe("summarizeReport", () => {
	test("warns when a plugin branch could not be resolved", () => {
		const summary = summarizeReport(reportWith([branchMissing]));
		expect(summary).toContain("branch-missing plannotator");
		expect(summary).toContain("\u26a0 Plugin branch missing: 1 plugin(s)");
	});

	test("stays quiet when every plugin step is healthy", () => {
		expect(summarizeReport(reportWith([checkoutBranch]))).not.toContain("Plugin branch missing");
	});
});
