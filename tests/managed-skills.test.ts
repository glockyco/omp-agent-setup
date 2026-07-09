import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LOCAL_MANAGED_SKILLS } from "../src/managed-skills.ts";

describe("LOCAL_MANAGED_SKILLS", () => {
	test("includes the OMP-native implementation plan authoring skill", () => {
		expect([...LOCAL_MANAGED_SKILLS]).toContain("writing-plans");
	});

	test("ships writing-plans as a visible managed skill", async () => {
		const skill = await readFile(
			join(import.meta.dir, "..", "agent", "skills", "writing-plans", "SKILL.md"),
			"utf8",
		);
		expect(skill).toContain("name: writing-plans");
		expect(skill).toContain("description: Use when turning approved requirements");
		expect(skill).not.toMatch(/^hide:\s*true$/m);
		expect(skill).not.toContain("superpowers");
		expect(skill).not.toContain("docs/superpowers");
	});
});
