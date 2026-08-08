import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	applyVendorFixes,
	assertPiImpeccableVariant,
	IMPECCABLE_VENDOR_FIXES,
	inspectPiImpeccableVariant,
	rewriteImpeccableScriptPaths,
	updateImpeccableFromBundle,
	type VendorFix,
} from "../src/impeccable-update.ts";
import { LOCAL_MANAGED_AGENTS } from "../src/managed-agents.ts";
import { planPatch } from "../src/patches.ts";

// biome-ignore lint/suspicious/noTemplateCurlyInString: literal bash parameter expansion the rewrite emits, not a JS template
const DEPLOYED_PREFIX = '"${OMP_AGENT_DIR:-$HOME/.omp/agent}"/skills/impeccable';

let root: string;
let bundle: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "omp-impeccable-root-"));
	bundle = await mkdtemp(join(tmpdir(), "omp-impeccable-bundle-"));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
	await rm(bundle, { recursive: true, force: true });
});

async function writeVendorFixTargets(skillDir: string) {
	const byTarget = Map.groupBy(IMPECCABLE_VENDOR_FIXES, fix => fix.targetRelative);
	for (const [targetRelative, fixes] of byTarget) {
		const target = join(skillDir, targetRelative);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, `${fixes.map(fix => fix.anchor).join("\n")}\n`);
	}
}

async function writeAgents(base: string, names: readonly string[] = LOCAL_MANAGED_AGENTS) {
	const agentsDir = join(base, ...[".claude", "agents"]);
	await mkdir(agentsDir, { recursive: true });
	for (const name of names) {
		await writeFile(
			join(agentsDir, `${name}.md`),
			[
				"---",
				`name: ${name}`,
				`description: Does ${name} work.`,
				"tools: Read, Bash, Glob, Grep",
				"model: inherit",
				"effort: medium",
				"maxTurns: 30",
				"---",
				`# ${name}`,
				"",
			].join("\n"),
		);
	}
}

async function writeSkill(base: string, versionLine: string) {
	const skillDir = join(base, ".pi", "skills", "impeccable");
	await mkdir(join(skillDir, "commands"), { recursive: true });
	await writeFile(
		join(skillDir, "SKILL.md"),
		`---\nname: impeccable\n${versionLine}\n---\n# Impeccable\n`,
	);
	await writeFile(join(skillDir, "commands", "critique.md"), "# Critique\n");
	await mkdir(join(skillDir, "scripts", "lib"), { recursive: true });
	await writeFile(
		join(skillDir, "scripts", "lib", "provider.mjs"),
		'export const IMPECCABLE_PROVIDER_ID = "pi";\n',
	);
	await writeVendorFixTargets(skillDir);
	await writeAgents(base);
}

describe("updateImpeccableFromBundle", () => {
	test("replaces only the vendored Pi impeccable skill", async () => {
		await mkdir(join(root, "agent", "skills", "impeccable", "stale"), { recursive: true });
		await writeFile(
			join(root, "agent", "skills", "impeccable", "SKILL.md"),
			"---\nname: impeccable\nversion: 1.0.0\n---\nold\n",
		);
		await writeFile(join(root, "agent", "skills", "impeccable", "stale", "old.md"), "old\n");
		await mkdir(join(root, "agent", "skills", "commit"), { recursive: true });
		await writeFile(join(root, "agent", "skills", "commit", "SKILL.md"), "# Commit\n");
		await writeSkill(bundle, "version: 2.0.0");
		await mkdir(join(bundle, ".claude", "skills", "impeccable"), { recursive: true });
		await writeFile(join(bundle, ".claude", "skills", "impeccable", "SKILL.md"), "wrong provider\n");

		const result = await updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle });

		expect(result.oldVersion).toBe("1.0.0");
		expect(result.newVersion).toBe("2.0.0");
		expect(
			await readFile(join(root, "agent", "skills", "impeccable", "commands", "critique.md"), "utf8"),
		).toBe("# Critique\n");
		expect(await readFile(join(root, "agent", "skills", "commit", "SKILL.md"), "utf8")).toBe(
			"# Commit\n",
		);
		await expect(
			readFile(join(root, "agent", "skills", "impeccable", "stale", "old.md"), "utf8"),
		).rejects.toThrow();
	});

	test("rejects bundles without a Pi impeccable skill", async () => {
		await expect(updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle })).rejects.toThrow(
			/Pi impeccable skill/,
		);
	});

	test("rejects bundles whose Pi skill has no version", async () => {
		await writeSkill(bundle, "");

		await expect(updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle })).rejects.toThrow(
			/version/,
		);
	});

	test("rejects a non-Pi provider after copying the bundle", async () => {
		await writeSkill(bundle, "version: 3.5.0");
		await writeFile(
			join(bundle, ".pi", "skills", "impeccable", "scripts", "lib", "provider.mjs"),
			'export const IMPECCABLE_PROVIDER_ID = "github";\n',
		);

		await expect(updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle })).rejects.toThrow(
			/scripts\/lib\/provider\.mjs.*github/,
		);
	});

	test("rewrites project-local script paths in vendored docs", async () => {
		const skillDir = join(bundle, ".pi", "skills", "impeccable");
		await mkdir(join(skillDir, "reference"), { recursive: true });
		await writeFile(
			join(skillDir, "SKILL.md"),
			"---\nname: impeccable\nversion: 3.5.0\n---\nRun `node .pi/skills/impeccable/scripts/context.mjs` once.\n",
		);
		await writeFile(
			join(skillDir, "reference", "live.md"),
			"node .pi/skills/impeccable/scripts/live-poll.mjs --stream\n",
		);
		await mkdir(join(skillDir, "scripts", "lib"), { recursive: true });
		await writeFile(
			join(skillDir, "scripts", "lib", "provider.mjs"),
			'export const IMPECCABLE_PROVIDER_ID = "pi";\n',
		);
		await writeVendorFixTargets(skillDir);
		await writeAgents(bundle);

		await updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle });

		const skill = await readFile(join(root, "agent", "skills", "impeccable", "SKILL.md"), "utf8");
		const live = await readFile(
			join(root, "agent", "skills", "impeccable", "reference", "live.md"),
			"utf8",
		);
		expect(skill).not.toContain(".pi/skills/impeccable");
		expect(skill).toContain(`node ${DEPLOYED_PREFIX}/scripts/context.mjs`);
		expect(live).not.toContain(".pi/skills/impeccable");
		expect(live).toContain(`${DEPLOYED_PREFIX}/scripts/live-poll.mjs`);
	});
});

describe("rewriteImpeccableScriptPaths", () => {
	test("rewrites every project-local script invocation", () => {
		expect(rewriteImpeccableScriptPaths("node .pi/skills/impeccable/scripts/context.mjs")).toBe(
			`node ${DEPLOYED_PREFIX}/scripts/context.mjs`,
		);
	});

	test("rewrites detect, hook-admin ignores, and managed update instructions", () => {
		const detect = "npx impeccable detect --no-config src/App.tsx";
		expect(rewriteImpeccableScriptPaths(detect)).toBe(
			`node ${DEPLOYED_PREFIX}/scripts/detect.mjs --no-config src/App.tsx`,
		);
		const ignores =
			"Use `npx impeccable ignores ...` for direct CLI CRUD on the same detector ignores.";
		expect(rewriteImpeccableScriptPaths(ignores)).toBe(
			`Use \`node ${DEPLOYED_PREFIX}/scripts/hook-admin.mjs\` with the \`ignore-rule\`, \`ignore-file\`, or \`ignore-value\` action for direct CLI CRUD on the same detector ignores.`,
		);
		const doctor =
			"- **Tool version.** The installed skill is older than the published one. `context.mjs` reports that at boot as `UPDATE_AVAILABLE` and `npx impeccable update` fixes it. Not this command's job.";
		expect(rewriteImpeccableScriptPaths(doctor)).toContain(
			"(cd ~/Projects/omp-agent-setup && bun run update-impeccable && bun run bootstrap)",
		);
	});

	test("drops the redundant allowed-tools npm suggestion", () => {
		const text = "  - Bash(npx impeccable *)";
		expect(rewriteImpeccableScriptPaths(text)).toBe("");
	});

	test("leaves unrelated text untouched", () => {
		const text = "Run `npx impeccable skills update`. The .pierre file is unrelated.";
		expect(rewriteImpeccableScriptPaths(text)).toBe(text);
	});

	test("is idempotent", () => {
		const once = rewriteImpeccableScriptPaths("node .pi/skills/impeccable/scripts/live.mjs");
		expect(rewriteImpeccableScriptPaths(once)).toBe(once);
	});
});

describe("applyVendorFixes", () => {
	test("applies a fix once and reports it as already applied afterwards", async () => {
		const fix = {
			id: "sample",
			targetRelative: "scripts/sample.mjs",
			description: "Sample fix.",
			anchor: "const guard = false;",
			replacement: "const guard = true; // FIXED",
			appliedSignature: "// FIXED",
		};
		await mkdir(join(root, "scripts"), { recursive: true });
		await writeFile(join(root, "scripts", "sample.mjs"), "const guard = false;\n");

		expect(await applyVendorFixes(root, [fix])).toEqual([{ id: "sample", kind: "apply" }]);
		expect(await readFile(join(root, "scripts", "sample.mjs"), "utf8")).toBe(
			"const guard = true; // FIXED\n",
		);
		expect(await applyVendorFixes(root, [fix])).toEqual([
			{ id: "sample", kind: "skip-already-applied" },
		]);
	});

	test("reports drift instead of editing when the anchor is gone", async () => {
		const fix = {
			id: "sample",
			targetRelative: "scripts/sample.mjs",
			description: "Sample fix.",
			anchor: "const guard = false;",
			replacement: "const guard = true; // FIXED",
			appliedSignature: "// FIXED",
		};
		await mkdir(join(root, "scripts"), { recursive: true });
		await writeFile(join(root, "scripts", "sample.mjs"), "const guard = maybe();\n");

		expect(await applyVendorFixes(root, [fix])).toEqual([
			{ id: "sample", kind: "skip-anchor-missing" },
		]);
		expect(await readFile(join(root, "scripts", "sample.mjs"), "utf8")).toBe(
			"const guard = maybe();\n",
		);
		expect(await applyVendorFixes(root, [{ ...fix, targetRelative: "scripts/absent.mjs" }])).toEqual([
			{ id: "sample", kind: "skip-target-missing" },
		]);
	});

	test("refuses to guess when the anchor matches more than once", async () => {
		const fix = {
			id: "sample",
			targetRelative: "scripts/sample.mjs",
			description: "Sample fix.",
			anchor: "const guard = false;",
			replacement: "const guard = true; // FIXED",
			appliedSignature: "// FIXED",
		};
		await mkdir(join(root, "scripts"), { recursive: true });
		await writeFile(
			join(root, "scripts", "sample.mjs"),
			"const guard = false;\nconst guard = false;\n",
		);

		await expect(applyVendorFixes(root, [fix])).rejects.toThrow(/matched its anchor 2 times/);
	});
});

describe("inspectPiImpeccableVariant", () => {
	const sampleFix = {
		id: "sample",
		targetRelative: "scripts/sample.mjs",
		description: "Sample fix.",
		anchor: "const guard = false;",
		replacement: "const guard = true; // FIXED",
		appliedSignature: "// FIXED",
	} satisfies VendorFix;

	async function writeProvider(value = "pi") {
		await mkdir(join(root, "scripts", "lib"), { recursive: true });
		await writeFile(
			join(root, "scripts", "lib", "provider.mjs"),
			`export const IMPECCABLE_PROVIDER_ID = "${value}";\n`,
		);
	}

	test("accepts healthy Pi content", async () => {
		await writeProvider();
		await writeFile(join(root, "SKILL.md"), "# Clean\n");

		expect(await inspectPiImpeccableVariant(root, [])).toEqual([]);
	});

	test("reports a missing and a wrong provider", async () => {
		expect(await inspectPiImpeccableVariant(root, [])).toEqual([
			{
				kind: "filesystem",
				path: "scripts/lib/provider.mjs",
				message:
					'scripts/lib/provider.mjs is missing or unreadable; expected IMPECCABLE_PROVIDER_ID = "pi".',
			},
		]);

		await writeProvider("github");
		expect(await inspectPiImpeccableVariant(root, [])).toEqual([
			{
				kind: "provider",
				path: "scripts/lib/provider.mjs",
				message: 'scripts/lib/provider.mjs has IMPECCABLE_PROVIDER_ID = "github"; expected "pi".',
			},
		]);
	});

	test("reports forbidden Markdown in stable path and marker order", async () => {
		await writeProvider();
		await writeFile(join(root, "z.md"), "npx impeccable and .pi/skills/impeccable\n");
		await writeFile(join(root, "a.md"), ".github/skills/impeccable\n");

		const issues = await inspectPiImpeccableVariant(root, []);

		expect(issues.map(issue => [issue.path, issue.message])).toEqual([
			["a.md", 'a.md contains forbidden ".github/skills/impeccable".'],
			["z.md", 'z.md contains forbidden "npx impeccable".'],
			["z.md", 'z.md contains forbidden ".pi/skills/impeccable".'],
		]);
	});

	test("reports a missing fix target", async () => {
		await writeProvider();

		expect(await inspectPiImpeccableVariant(root, [sampleFix])).toEqual([
			{
				kind: "filesystem",
				path: "scripts/sample.mjs",
				message: "scripts/sample.mjs for vendor fix sample is missing or unreadable.",
				fixId: "sample",
			},
		]);
	});

	test.each([
		{
			content: "const guard = false;\n",
			message: "Vendor fix sample is not applied in scripts/sample.mjs.",
		},
		{
			content: "const guard = maybe();\n",
			message: "Vendor fix sample anchor is missing from scripts/sample.mjs.",
		},
		{
			content: "const guard = false;\nconst guard = false;\n",
			message:
				"Vendor fix sample matched its anchor 2 times in scripts/sample.mjs; refusing to guess.",
		},
	])("reports every non-applied patch outcome", async ({ content, message }) => {
		await writeProvider();
		await writeFile(join(root, "scripts", "sample.mjs"), content);

		const issues = await inspectPiImpeccableVariant(root, [sampleFix]);

		expect(issues).toEqual([
			{
				kind: "vendor-fix",
				path: "scripts/sample.mjs",
				message,
				fixId: "sample",
			},
		]);
	});
});

// The vendored tree is what actually deploys, so a re-vendor that dropped a fix
// (upstream moved the anchor, someone ran the copy step without the fix pass)
// must fail here rather than in a design session.
describe("vendored impeccable skill", () => {
	const skillDir = join(import.meta.dir, "..", "agent", "skills", "impeccable");

	test.each(
		IMPECCABLE_VENDOR_FIXES.map(fix => [fix.id, fix] as const),
	)("carries the %s fix", async (_id, fix) => {
		const content = await readFile(join(skillDir, fix.targetRelative), "utf8");
		expect(planPatch(fix, content).kind).toBe("skip-already-applied");
	});

	test("accepts the checked-in Pi variant", async () => {
		await assertPiImpeccableVariant(skillDir);
	});

	test("rejects a markdown npm command", async () => {
		await mkdir(join(root, "scripts", "lib"), { recursive: true });
		await writeFile(
			join(root, "scripts", "lib", "provider.mjs"),
			'export const IMPECCABLE_PROVIDER_ID = "pi";\n',
		);
		const doc = join(root, "variant.md");
		await writeFile(doc, "Run `npx impeccable detect`.\n");

		await expect(assertPiImpeccableVariant(root)).rejects.toThrow(/variant\.md.*npx impeccable/);
	});

	test("concept-seed.mjs writes its seed when invoked through a symlinked skill dir", async () => {
		const link = join(root, "impeccable-link");
		await symlink(skillDir, link);

		// No PRODUCT.md in `root`, so the script stops at its init gate. That is
		// still proof the CLI block ran: before the fix this printed nothing and
		// exited 0 for every invocation through a symlinked path.
		const result = Bun.spawnSync({
			cmd: ["node", join(link, "scripts", "concept-seed.mjs"), "--scope", "surface"],
			cwd: root,
			env: { ...process.env, IMPECCABLE_API_URL: "http://127.0.0.1:1" },
		});

		expect(result.stdout.toString()).toContain("NO_PRODUCT_MD");
		expect(result.exitCode).toBe(1);
	});
});

describe("updateImpeccableFromBundle agents", () => {
	test("vendors every Claude agent through the translation", async () => {
		await writeSkill(bundle, "version: 2.0.0");

		const result = await updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle });

		expect(result.agents).toEqual([...LOCAL_MANAGED_AGENTS].sort().map(name => `${name}.md`));
		const written = await readFile(
			join(root, "agent", "agents", "impeccable-finish-reviewer.md"),
			"utf8",
		);
		expect(written).toContain("tools: read, bash, glob, grep, yield");
		expect(written).toContain("thinkingLevel: medium");
		expect(written).not.toContain("maxTurns");
	});

	test("clears agents the bundle no longer ships", async () => {
		await mkdir(join(root, "agent", "agents"), { recursive: true });
		await writeFile(join(root, "agent", "agents", "impeccable-retired.md"), "stale\n");
		await writeSkill(bundle, "version: 2.0.0");

		await updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle });

		await expect(
			readFile(join(root, "agent", "agents", "impeccable-retired.md"), "utf8"),
		).rejects.toThrow();
	});

	test("is idempotent across a re-vendor", async () => {
		await writeSkill(bundle, "version: 2.0.0");
		await updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle });
		const first = await readFile(join(root, "agent", "agents", "impeccable-documenter.md"), "utf8");

		await updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle });

		expect(await readFile(join(root, "agent", "agents", "impeccable-documenter.md"), "utf8")).toBe(
			first,
		);
	});

	test("rejects a bundle with no Claude agents directory", async () => {
		await writeSkill(bundle, "version: 2.0.0");
		await rm(join(bundle, ".claude", "agents"), { recursive: true, force: true });

		await expect(updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle })).rejects.toThrow(
			/does not contain Claude agent definitions/,
		);
	});

	test("rejects agents that do not match the registry, naming both sets", async () => {
		await writeSkill(bundle, "version: 2.0.0");
		await rm(join(bundle, ".claude", "agents", "impeccable-documenter.md"), { force: true });
		await writeAgents(bundle, ["impeccable-newcomer"]);

		const error = await updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle }).then(
			() => null,
			(caught: unknown) => caught as Error,
		);

		expect(error?.message).toContain("impeccable-documenter");
		expect(error?.message).toContain("impeccable-newcomer");
	});

	test("leaves the vendored agents untouched when a translation fails", async () => {
		await writeSkill(bundle, "version: 2.0.0");
		await updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle });
		const before = await readFile(join(root, "agent", "agents", "impeccable-documenter.md"), "utf8");
		const poisoned = join(bundle, ".claude", "agents", "impeccable-documenter.md");
		await writeFile(
			poisoned,
			(await readFile(poisoned, "utf8")).replace("tools: Read", "tools: Telepathy"),
		);

		await expect(updateImpeccableFromBundle({ repoRoot: root, bundleRoot: bundle })).rejects.toThrow(
			/unrecognised tool name/,
		);
		expect(await readFile(join(root, "agent", "agents", "impeccable-documenter.md"), "utf8")).toBe(
			before,
		);
	});
});
