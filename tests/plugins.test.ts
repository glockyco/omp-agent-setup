import { describe, expect, test } from "bun:test";
import {
	type CheckoutStep,
	executeCheckoutSteps,
	type GitProbe,
	type GitRunner,
	type PluginSpec,
	parseManifest,
	planPluginCheckout,
} from "../src/plugins.ts";

const HOME = "/Users/test";

const MANIFEST_YAML = `plugins:
  plannotator:
    path: ~/Projects/plannotator
    upstream: https://github.com/backnotprop/plannotator.git
    fork: https://github.com/glockyco/plannotator.git
    branch: omp-local
    currentCommit: deadbeef
    purpose: Plannotator review UI integration
`;

describe("parseManifest", () => {
	test("expands ~ in the path and exposes all required fields", () => {
		const manifest = parseManifest(MANIFEST_YAML, HOME);
		expect(manifest.plugins).toHaveLength(1);
		const plugin = manifest.plugins.find(p => p.name === "plannotator");
		expect(plugin).toBeDefined();
		expect(plugin?.path).toBe("~/Projects/plannotator");
		expect(plugin?.pathExpanded).toBe("/Users/test/Projects/plannotator");
		expect(plugin?.branch).toBe("omp-local");
		expect(plugin?.currentCommit).toBe("deadbeef");
		expect(plugin?.purpose).toContain("review UI");
	});

	test("rejects entries missing required fields", () => {
		const bad = "plugins:\n  broken:\n    upstream: x\n    fork: y\n    branch: z\n";
		expect(() => parseManifest(bad, HOME)).toThrow(/missing required field path/);
	});

	test("rejects manifests without a plugins map", () => {
		expect(() => parseManifest("foo: bar\n", HOME)).toThrow(/top-level `plugins` map/);
	});
});

const PLUGIN_SPEC: PluginSpec = {
	name: "plannotator",
	path: "~/Projects/plannotator",
	pathExpanded: "/tmp/plannotator",
	upstream: "https://up",
	fork: "https://fork",
	branch: "omp-local",
};

const stubProbe = (overrides: Partial<GitProbe>): GitProbe => ({
	async hasGit() {
		return false;
	},
	async getRemoteUrl() {
		return null;
	},
	async hasLocalBranch() {
		return false;
	},
	async hasOriginBranch() {
		return false;
	},
	...overrides,
});

describe("planPluginCheckout", () => {
	test("plans clone + upstream + origin-branch checkout when repo is absent", async () => {
		const steps = await planPluginCheckout(PLUGIN_SPEC, stubProbe({ hasGit: async () => false }));
		expect(steps).toEqual([
			{ kind: "clone", plugin: PLUGIN_SPEC },
			{ kind: "set-upstream", plugin: PLUGIN_SPEC, upstream: "https://up" },
			{ kind: "checkout-branch", plugin: PLUGIN_SPEC, branch: "omp-local", source: "origin" },
		]);
	});

	test("plans local checkout when branch already exists", async () => {
		const steps = await planPluginCheckout(
			PLUGIN_SPEC,
			stubProbe({
				hasGit: async () => true,
				getRemoteUrl: async (_p, remote) => (remote === "origin" ? "https://fork" : "https://up"),
				hasLocalBranch: async () => true,
			}),
		);
		expect(steps).toEqual([
			{ kind: "checkout-branch", plugin: PLUGIN_SPEC, branch: "omp-local", source: "local" },
		]);
	});

	test("repairs drifted remotes before checking out", async () => {
		const steps = await planPluginCheckout(
			PLUGIN_SPEC,
			stubProbe({
				hasGit: async () => true,
				getRemoteUrl: async (_p, remote) => (remote === "origin" ? "https://wrong-fork" : null),
				hasOriginBranch: async () => true,
			}),
		);
		expect(steps).toEqual([
			{ kind: "set-origin", plugin: PLUGIN_SPEC, fork: "https://fork" },
			{ kind: "set-upstream", plugin: PLUGIN_SPEC, upstream: "https://up" },
			{ kind: "checkout-branch", plugin: PLUGIN_SPEC, branch: "omp-local", source: "origin" },
		]);
	});

	test("reports branch-missing when neither local nor origin has the branch", async () => {
		const steps = await planPluginCheckout(
			PLUGIN_SPEC,
			stubProbe({
				hasGit: async () => true,
				getRemoteUrl: async () => "https://fork",
				hasLocalBranch: async () => false,
				hasOriginBranch: async () => false,
			}),
		);
		const last = steps.at(-1);
		expect(last).toEqual({ kind: "branch-missing", plugin: PLUGIN_SPEC, branch: "omp-local" });
	});
});

describe("executeCheckoutSteps", () => {
	const recordRunner = (): GitRunner & { calls: string[][] } => {
		const calls: string[][] = [];
		return {
			calls,
			async run(args) {
				calls.push([...args]);
				return { stdout: "", stderr: "" };
			},
		};
	};

	const checkoutBranchStep = (source: "local" | "origin"): CheckoutStep => ({
		kind: "checkout-branch",
		plugin: PLUGIN_SPEC,
		branch: PLUGIN_SPEC.branch,
		source,
	});

	test("checkout-branch local invokes plain checkout", async () => {
		const runner = recordRunner();
		await executeCheckoutSteps([checkoutBranchStep("local")], runner, stubProbe({}));
		expect(runner.calls).toEqual([["-C", PLUGIN_SPEC.pathExpanded, "checkout", "omp-local"]]);
	});

	test("checkout-branch origin invokes checkout -B against origin ref", async () => {
		const runner = recordRunner();
		await executeCheckoutSteps([checkoutBranchStep("origin")], runner, stubProbe({}));
		expect(runner.calls).toEqual([
			["-C", PLUGIN_SPEC.pathExpanded, "checkout", "-B", "omp-local", "origin/omp-local"],
		]);
	});

	test("set-origin invokes remote set-url origin", async () => {
		const runner = recordRunner();
		await executeCheckoutSteps(
			[{ kind: "set-origin", plugin: PLUGIN_SPEC, fork: PLUGIN_SPEC.fork }],
			runner,
			stubProbe({}),
		);
		expect(runner.calls).toEqual([
			["-C", PLUGIN_SPEC.pathExpanded, "remote", "set-url", "origin", PLUGIN_SPEC.fork],
		]);
	});

	test("set-upstream adds remote when missing, set-urls when present", async () => {
		const missingProbe = stubProbe({ getRemoteUrl: async () => null });
		const missingRunner = recordRunner();
		await executeCheckoutSteps(
			[{ kind: "set-upstream", plugin: PLUGIN_SPEC, upstream: PLUGIN_SPEC.upstream }],
			missingRunner,
			missingProbe,
		);
		expect(missingRunner.calls).toEqual([
			["-C", PLUGIN_SPEC.pathExpanded, "remote", "add", "upstream", PLUGIN_SPEC.upstream],
		]);

		const presentProbe = stubProbe({ getRemoteUrl: async () => "https://old" });
		const presentRunner = recordRunner();
		await executeCheckoutSteps(
			[{ kind: "set-upstream", plugin: PLUGIN_SPEC, upstream: PLUGIN_SPEC.upstream }],
			presentRunner,
			presentProbe,
		);
		expect(presentRunner.calls).toEqual([
			["-C", PLUGIN_SPEC.pathExpanded, "remote", "set-url", "upstream", PLUGIN_SPEC.upstream],
		]);
	});

	test("branch-missing is non-fatal and emits no git calls", async () => {
		const runner = recordRunner();
		await executeCheckoutSteps(
			[{ kind: "branch-missing", plugin: PLUGIN_SPEC, branch: PLUGIN_SPEC.branch }],
			runner,
			stubProbe({}),
		);
		expect(runner.calls).toEqual([]);
	});
});

import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("executeCheckoutSteps clone", () => {
	test("clone creates parent dir then invokes git clone", async () => {
		const work = await mkdtemp(join(tmpdir(), "omp-clone-test-"));
		try {
			const target = join(work, "nested/repo");
			const calls: string[][] = [];
			const runner: GitRunner = {
				async run(args) {
					calls.push([...args]);
					return { stdout: "", stderr: "" };
				},
			};
			const spec: PluginSpec = { ...PLUGIN_SPEC, pathExpanded: target };
			await executeCheckoutSteps([{ kind: "clone", plugin: spec }], runner, stubProbe({}));
			expect(calls).toEqual([["clone", PLUGIN_SPEC.fork, target]]);
			const parentEntries = await readdir(join(work, "nested"));
			expect(parentEntries).toEqual([]);
		} finally {
			await rm(work, { recursive: true, force: true });
		}
	});
});
