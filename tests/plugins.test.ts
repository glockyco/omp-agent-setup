import { describe, expect, test } from "bun:test";
import { parseManifest, planPluginCheckout, type GitProbe, type PluginSpec } from "../src/plugins.ts";

const HOME = "/Users/test";

const MANIFEST_YAML = `plugins:
  superpowers:
    path: ~/Projects/superpowers
    upstream: https://github.com/obra/superpowers.git
    fork: https://github.com/glockyco/superpowers.git
    branch: omp-local
    currentCommit: deadbeef
    purpose: Superpowers OMP bootstrap compatibility
  plannotator:
    path: ~/Projects/plannotator
    upstream: https://github.com/backnotprop/plannotator.git
    fork: https://github.com/glockyco/plannotator.git
    branch: omp-local
`;

describe("parseManifest", () => {
	test("expands ~ in the path and exposes all required fields", () => {
		const manifest = parseManifest(MANIFEST_YAML, HOME);
		expect(manifest.plugins).toHaveLength(2);
		const sp = manifest.plugins.find(p => p.name === "superpowers");
		expect(sp).toBeDefined();
		expect(sp?.path).toBe("~/Projects/superpowers");
		expect(sp?.pathExpanded).toBe("/Users/test/Projects/superpowers");
		expect(sp?.branch).toBe("omp-local");
		expect(sp?.currentCommit).toBe("deadbeef");
		expect(sp?.purpose).toContain("OMP bootstrap");
	});

	test("rejects entries missing required fields", () => {
		const bad = "plugins:\n  broken:\n    upstream: x\n    fork: y\n    branch: z\n";
		expect(() => parseManifest(bad, HOME)).toThrow(/missing required field path/);
	});

	test("rejects manifests without a plugins map", () => {
		expect(() => parseManifest("foo: bar\n", HOME)).toThrow(/top-level `plugins` map/);
	});
});

const SP_SPEC: PluginSpec = {
	name: "superpowers",
	path: "~/Projects/superpowers",
	pathExpanded: "/tmp/sp",
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
		const steps = await planPluginCheckout(SP_SPEC, stubProbe({ hasGit: async () => false }));
		expect(steps).toEqual([
			{ kind: "clone", plugin: SP_SPEC },
			{ kind: "set-upstream", plugin: SP_SPEC, upstream: "https://up" },
			{ kind: "checkout-branch", plugin: SP_SPEC, branch: "omp-local", source: "origin" },
		]);
	});

	test("plans local checkout when branch already exists", async () => {
		const steps = await planPluginCheckout(
			SP_SPEC,
			stubProbe({
				hasGit: async () => true,
				getRemoteUrl: async (_p, remote) =>
					remote === "origin" ? "https://fork" : "https://up",
				hasLocalBranch: async () => true,
			}),
		);
		expect(steps).toEqual([
			{ kind: "checkout-branch", plugin: SP_SPEC, branch: "omp-local", source: "local" },
		]);
	});

	test("repairs drifted remotes before checking out", async () => {
		const steps = await planPluginCheckout(
			SP_SPEC,
			stubProbe({
				hasGit: async () => true,
				getRemoteUrl: async (_p, remote) =>
					remote === "origin" ? "https://wrong-fork" : null,
				hasOriginBranch: async () => true,
			}),
		);
		expect(steps).toEqual([
			{ kind: "set-origin", plugin: SP_SPEC, fork: "https://fork" },
			{ kind: "set-upstream", plugin: SP_SPEC, upstream: "https://up" },
			{ kind: "checkout-branch", plugin: SP_SPEC, branch: "omp-local", source: "origin" },
		]);
	});

	test("reports branch-missing when neither local nor origin has the branch", async () => {
		const steps = await planPluginCheckout(
			SP_SPEC,
			stubProbe({
				hasGit: async () => true,
				getRemoteUrl: async () => "https://fork",
				hasLocalBranch: async () => false,
				hasOriginBranch: async () => false,
			}),
		);
		const last = steps.at(-1);
		expect(last).toEqual({ kind: "branch-missing", plugin: SP_SPEC, branch: "omp-local" });
	});
});
