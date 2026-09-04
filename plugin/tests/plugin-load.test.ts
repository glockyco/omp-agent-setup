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
		expect(manifest.bin).toBeUndefined();
		expect(existsSync(join(pluginRoot, "bin"))).toBe(false);
		expect(existsSync(join(pluginRoot, "agents"))).toBe(false);
		expect(existsSync(join(pluginRoot, "models"))).toBe(false);
	});

	test("loads the declared extension factory and registers personal_commit", async () => {
		const manifest = await Bun.file(join(pluginRoot, "package.json")).json();
		const registrations: Array<Record<string, unknown>> = [];
		// OMP's schema values are chainable, so a double that returns a plain
		// object would pass while the real runtime rejected the extension.
		const schema = (value: Record<string, unknown>): Record<string, unknown> => ({
			...value,
			optional: () => schema({ ...value, optional: true }),
			describe: (description: string) => schema({ ...value, description }),
		});
		const api = {
			zod: {
				string: () => schema({ type: "string" }),
				enum: (values: readonly string[]) => schema({ type: "enum", values }),
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
		const lsp = await Bun.file(join(pluginRoot, "lsp", "lsp.json")).json();
		expect(Object.keys(lsp.servers).sort()).toEqual([
			"markdown-oxide",
			"marksman",
			"roslyn-language-server",
			"svelte",
		]);
		expect(lsp.servers.marksman).toEqual({ disabled: true });
		expect(lsp.servers["markdown-oxide"]).toEqual({
			command: "markdown-oxide",
			args: [],
			fileTypes: [".md", ".markdown"],
			rootMarkers: [".moxide.toml", ".obsidian", ".git"],
			warmupTimeoutMs: 2000,
		});
	});
});
