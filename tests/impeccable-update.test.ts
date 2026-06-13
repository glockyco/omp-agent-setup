import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { updateImpeccableFromBundle } from "../src/impeccable-update.ts";

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

		expect(result).toEqual({ oldVersion: "1.0.0", newVersion: "2.0.0" });
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
});
