import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	applyVendorFixes,
	IMPECCABLE_VENDOR_FIXES,
	rewriteImpeccableScriptPaths,
	updateImpeccableFromBundle,
} from "../src/impeccable-update.ts";
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

async function writeSkill(base: string, versionLine: string) {
	const skillDir = join(base, ".pi", "skills", "impeccable");
	await mkdir(join(skillDir, "commands"), { recursive: true });
	await writeFile(
		join(skillDir, "SKILL.md"),
		`---\nname: impeccable\n${versionLine}\n---\n# Impeccable\n`,
	);
	await writeFile(join(skillDir, "commands", "critique.md"), "# Critique\n");
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
