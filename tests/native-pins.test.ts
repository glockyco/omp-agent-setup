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
	packageRules: { matchPackageNames?: string[]; groupName: string }[];
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
	expect(extract(".omp-version", "v18.8.7\n")).toEqual([
		{ dependency: "can1357/oh-my-pi", datasource: "github-tags", value: "v18.8.7" },
	]);
	expect(extract(".github/workflows/openspec.yml", "@fission-ai/openspec@1.14.0")).toEqual([
		{ dependency: "@fission-ai/openspec", datasource: "npm", value: "1.14.0" },
	]);
	expect(extract(".github/workflows/ci.yml", "python-version: '3.13'")).toEqual([
		{ dependency: "python", datasource: "python-version", value: "3.13" },
	]);
	expect(renovate.nix.enabled).toBe(false);
	expect(renovate.automerge).toBe(false);
	expect(
		renovate.packageRules.find(rule => rule.matchPackageNames?.includes("pywinpty"))?.groupName,
	).toBe("native Python terminal tooling");
});

test("candidate Bun/OpenSpec updates share groups and extract coherently at both boundaries", () => {
	const bunGroup = renovate.packageRules.find(rule => rule.matchPackageNames?.includes("bun"));
	expect(bunGroup?.matchPackageNames).toContain("oven-sh/bun");
	expect(extract(".bun-version", "1.3.14\n")[0]?.value).toBe("1.3.14");
	expect(extract("renovate.json", '"bun": "1.3.14"')[0]?.value).toBe("1.3.14");
	expect(
		renovate.packageRules.find(rule => rule.matchPackageNames?.includes("@fission-ai/openspec"))
			?.groupName,
	).toBe("OpenSpec generator and fleet gate");
	expect(extract(".github/workflows/openspec.yml", "@fission-ai/openspec@1.14.1")[0]?.value).toBe(
		"1.14.1",
	);
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
		jobs: { check: { strategy: { matrix: { os: string[] } } }; openspec: { uses: string } };
	};
	expect(matrix.jobs.check.strategy.matrix.os).toEqual([
		"ubuntu-latest",
		"macos-15",
		"windows-latest",
	]);
	expect(matrix.jobs.openspec.uses).toBe("./.github/workflows/openspec.yml");
});
