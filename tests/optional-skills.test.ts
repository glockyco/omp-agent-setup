import { describe, expect, test } from "bun:test";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { findOptionalSkill, LOCAL_OPTIONAL_SKILLS } from "../src/optional-skills.ts";

const payloadDir = join(import.meta.dir, "..", "agent", "optional-skills", "simple-english");

describe("LOCAL_OPTIONAL_SKILLS", () => {
	test("registers simple-english pinned to a full upstream commit", () => {
		const skill = LOCAL_OPTIONAL_SKILLS.find(entry => entry.name === "simple-english");
		expect(skill).toBeDefined();
		expect(skill?.repo).toBe("AminBlg/SimpleEnglish");
		expect(skill?.sourceDir).toBe("skills/simple-english");
		expect(skill?.commit).toMatch(/^[0-9a-f]{40}$/);
	});

	test("resolves known names and rejects unknown ones", () => {
		expect(findOptionalSkill("simple-english")?.name).toBe("simple-english");
		expect(findOptionalSkill("nonesuch")).toBeUndefined();
	});

	test("ships a loadable, unhidden SKILL.md matching its directory name", async () => {
		const skill = await readFile(join(payloadDir, "SKILL.md"), "utf8");
		expect(skill).toMatch(/^name:\s*simple-english\s*$/m);
		expect(skill).toContain("description:");
		// OMP's project scan uses `requireDescription: true`, and a hidden or
		// disabled skill would deploy fine yet never load in an opted-in repo.
		expect(skill).not.toMatch(/^hide:\s*true$/m);
		expect(skill).not.toMatch(/^enabled:\s*false$/m);
	});

	test("vendors the reference files SKILL.md links to", async () => {
		for (const rel of ["references/checklist.md", "references/use-cases.md"]) {
			expect((await stat(join(payloadDir, rel))).isFile()).toBe(true);
		}
	});
});
