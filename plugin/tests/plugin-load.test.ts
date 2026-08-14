import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const pluginRoot = process.env.PERSONAL_PLUGIN_DIR ?? join(import.meta.dir, "..");

describe("packaged plugin", () => {
	test("declares one extension and no agent or model payload", async () => {
		const manifest = await Bun.file(join(pluginRoot, "package.json")).json();
		expect(manifest.name).toBe("@glockyco/personal-omp-plugin");
		expect(manifest.omp.extensions).toEqual(["./extensions/personal-commit.ts"]);
		expect(existsSync(join(pluginRoot, "agents"))).toBe(false);
		expect(existsSync(join(pluginRoot, "models"))).toBe(false);
	});

	test("loads the declared extension factory and registers personal_commit", async () => {
		const manifest = await Bun.file(join(pluginRoot, "package.json")).json();
		const registrations: Array<Record<string, unknown>> = [];
		const api = {
			zod: {
				string: () => ({ type: "string" }),
				enum: (values: readonly string[]) => ({ type: "enum", values }),
				object: (shape: Record<string, unknown>) => ({ type: "object", shape }),
			},
			registerTool: (definition: Record<string, unknown>) => registrations.push(definition),
		};
		for (const relative of manifest.omp.extensions) {
			// This intentionally exercises OMP's runtime-selected manifest loading boundary.
			const module = await import(pathToFileURL(join(pluginRoot, relative)).href);
			module.default(api);
		}
		expect(registrations.map(item => item.name)).toEqual(["personal_commit"]);
	});

	test("contains exactly the selected skills, policy, and LSP overrides", async () => {
		for (const skill of ["commit-policy", "research-evidence", "simplified-technical-english"]) {
			expect(existsSync(join(pluginRoot, "skills", skill, "SKILL.md"))).toBe(true);
		}
		expect(existsSync(join(pluginRoot, "rules", "personal-policy.md"))).toBe(true);
		const lsp = await Bun.file(join(pluginRoot, "lsp.json")).json();
		expect(Object.keys(lsp.servers).sort()).toEqual(["roslyn-language-server", "svelte"]);
	});
});
