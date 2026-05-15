import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { managedAgentChecks, REQUIRED_SKILLS } from "../src/cli.ts";

describe("managedAgentChecks", () => {
	const localSkillNames = [
		"commit",
		"writing-project-readmes",
		"writing-agent-instructions",
		"writing-omp-skills",
	];

	test("includes source-managed local skills as managed symlinks", () => {
		const agentDir = "/tmp/omp-agent";
		const checks = managedAgentChecks(agentDir);

		for (const skillName of localSkillNames) {
			expect(checks).toContainEqual([
				join(agentDir, "skills", skillName),
				`skills/${skillName}`,
				"symlink",
			]);
		}
	});

	test("requires source-managed local skills during verification", () => {
		for (const skillName of localSkillNames) {
			expect(REQUIRED_SKILLS).toContain(skillName);
		}
	});

	test("requires the OMP-local skill authoring adapter, not a colliding Superpowers name", () => {
		expect(REQUIRED_SKILLS).toContain("writing-omp-skills");
		expect(REQUIRED_SKILLS).not.toContain("writing-skills");
	});
});
