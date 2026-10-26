import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repository = join(import.meta.dir, "..");
interface Manager {
	managerFilePatterns: string[];
	matchStrings: string[];
	depNameTemplate: string;
	datasourceTemplate: string;
	packageNameTemplate?: string;
}
const renovate = JSON.parse(readFileSync(join(repository, "renovate.json"), "utf8")) as {
	customManagers: Manager[];
	nix: { enabled: boolean };
	automerge: boolean;
	packageRules: { matchPackageNames?: string[]; groupName?: string; enabled?: boolean }[];
};
function extract(
	path: string,
	content: string,
): { dependency: string; datasource: string; value: string }[] {
	const result: { dependency: string; datasource: string; value: string }[] = [];
	for (const manager of renovate.customManagers) {
		if (!manager.managerFilePatterns.some(pattern => new RegExp(pattern.slice(1, -1)).test(path)))
			continue;
		for (const pattern of manager.matchStrings) {
			for (const match of content.matchAll(new RegExp(pattern, "g"))) {
				const value = match.groups?.currentValue;
				if (value)
					result.push({
						dependency: manager.packageNameTemplate ?? manager.depNameTemplate,
						datasource: manager.datasourceTemplate,
						value,
					});
			}
		}
	}
	return result;
}

test("Renovate extracts native pins under their actual upstream identities and keeps Nix disabled", () => {
	expect(extract(".bun-version", "1.3.13\n")).toEqual([
		{ dependency: "oven-sh/bun", datasource: "github-tags", value: "1.3.13" },
	]);
	expect(extract("renovate.json", '"bun": "1.3.13"')).toEqual([
		{ dependency: "oven-sh/bun", datasource: "github-tags", value: "1.3.13" },
	]);
	expect(extract(".omp-version", JSON.stringify({ tag: "v18.8.7", assets: {} }))).toEqual([
		{ dependency: "can1357/oh-my-pi", datasource: "github-tags", value: "v18.8.7" },
	]);
	expect(extract(".github/workflows/openspec.yml", "@fission-ai/openspec@1.14.0")).toEqual([]);
	expect(extract(".github/workflows/ci.yml", "python-version: '3.13'")).toEqual([
		{ dependency: "python", datasource: "python-version", value: "3.13" },
	]);
	expect(renovate.nix.enabled).toBe(false);
	expect(renovate.automerge).toBe(false);
	expect(
		renovate.packageRules.find(rule => rule.matchPackageNames?.includes("pywinpty"))?.groupName,
	).toBe("native Python terminal tooling");
});

test("OMP retains JSON extraction identity but requires manual whole-pin updates", () => {
	const record = readFileSync(join(repository, ".omp-version"), "utf8");
	expect(extract(".omp-version", record)).toEqual([
		{ dependency: "can1357/oh-my-pi", datasource: "github-tags", value: JSON.parse(record).tag },
	]);
	expect(extract(".omp-version", '{ "tag": "v18.8.8", "assets": {} }')).toEqual([
		{ dependency: "can1357/oh-my-pi", datasource: "github-tags", value: "v18.8.8" },
	]);
	expect(extract(".omp-version", "v18.8.7\n")).toEqual([]);
	expect(extract(".omp-version", '{ "tag": "latest" }')).toEqual([]);
	const ompRule = renovate.packageRules.find(rule =>
		rule.matchPackageNames?.includes("can1357/oh-my-pi"),
	);
	expect(ompRule?.enabled).toBe(false);
	expect(renovate.automerge).toBe(false);
	const scripts = JSON.parse(readFileSync(join(repository, "package.json"), "utf8")).scripts;
	expect(scripts["sync:release-omp"]).toBe("bun scripts/sync-release-omp.ts");
});

test("Bun pins share a group while Renovate leaves OpenSpec to the coordinated update", () => {
	const bunGroup = renovate.packageRules.find(rule => rule.matchPackageNames?.includes("bun"));
	expect(bunGroup?.matchPackageNames).toContain("oven-sh/bun");
	expect(extract(".bun-version", "1.3.14\n")[0]?.value).toBe("1.3.14");
	expect(extract("renovate.json", '"bun": "1.3.14"')[0]?.value).toBe("1.3.14");
	const openspecRule = renovate.packageRules.find(rule =>
		rule.matchPackageNames?.includes("@fission-ai/openspec"),
	);
	expect(openspecRule?.enabled).toBe(false);
	expect(extract(".github/workflows/openspec.yml", "@fission-ai/openspec@1.14.1")).toEqual([]);
	// Only pins that must move with generated artifacts stay out of Renovate.
	const disabled = renovate.packageRules
		.filter(rule => rule.enabled === false)
		.flatMap(rule => rule.matchPackageNames ?? []);
	expect(disabled.sort()).toEqual(["@fission-ai/openspec", "can1357/oh-my-pi"]);
	const scripts = JSON.parse(readFileSync(join(repository, "package.json"), "utf8")).scripts;
	expect(scripts["sync:openspec-adapters"]).toBe("bun scripts/openspec-adapters.ts sync");
});

test("reusable gate exposes only optional root and native CI selects all required hosts", () => {
	const shared = Bun.YAML.parse(
		readFileSync(join(repository, ".github/workflows/openspec.yml"), "utf8"),
	) as {
		on: {
			workflow_call: {
				inputs: Record<
					string,
					{ description: string; required: boolean; type: string; default: string }
				>;
			};
		};
		permissions: { contents: string };
		jobs: { validate: { "runs-on": string } };
	};
	expect(shared.on.workflow_call.inputs).toEqual({
		"openspec-root": {
			description: "Repository-relative directory containing openspec/",
			required: false,
			type: "string",
			default: ".",
		},
	});
	expect(shared.permissions.contents).toBe("read");
	expect(shared.jobs.validate["runs-on"]).toBe("ubuntu-latest");
	const matrix = Bun.YAML.parse(
		readFileSync(join(repository, ".github/workflows/ci.yml"), "utf8"),
	) as {
		jobs: {
			check: {
				strategy: { matrix: { os: string[] } };
				steps: Array<{ run?: string; id?: string; if?: string }>;
			};
			openspec: { uses: string };
		};
	};
	expect(matrix.jobs.check.strategy.matrix.os).toEqual([
		"ubuntu-latest",
		"macos-15",
		"windows-latest",
	]);
	expect(matrix.jobs.openspec.uses).toBe("./.github/workflows/openspec.yml");
	const steps = matrix.jobs.check.steps;
	expect(steps.find(step => step.run === "bun run setup:release-omp")?.id).toBe("omp_setup");
	expect(steps.find(step => step.run === "bun run setup:release-omp --cleanup")?.if).toBe(
		"always() && steps.omp_setup.outcome == 'success'",
	);
});
