import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { managedAgentChecks, REQUIRED_SKILLS } from "../src/cli.ts";

describe("managedAgentChecks", () => {
	const localSkillNames = [
		"commit",
		"writing-project-readmes",
		"writing-agent-instructions",
		"impeccable",
		"planning-files",
		"writing-plans",
		"searching-literature",
		"retrieving-paper-pdfs",
		"formatting-bibtex-entries",
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

	test("checks mcp.json as a merged file, not a symlink", () => {
		const agentDir = "/tmp/omp-agent";
		const checks = managedAgentChecks(agentDir);

		expect(checks).toContainEqual([join(agentDir, "mcp.json"), "mcp.json", "file"]);
	});

	test("includes source-managed rules as managed symlinks", () => {
		const agentDir = "/tmp/omp-agent";
		const checks = managedAgentChecks(agentDir);

		for (const rule of ["planning-docs", "remnote"]) {
			expect(checks).toContainEqual([
				join(agentDir, "rules", `${rule}.md`),
				`rules/${rule}.md`,
				"symlink",
			]);
		}
	});

	test("checks the OMP session environment extension", () => {
		const agentDir = "/tmp/omp-agent";
		const checks = managedAgentChecks(agentDir);

		expect(checks).toContainEqual([
			join(agentDir, "extensions", "omp-session-env.ts"),
			"omp-session-env.ts",
			"symlink",
		]);
		expect(checks).not.toContainEqual([
			join(agentDir, "extensions", "superpowers-bootstrap.ts"),
			"superpowers-bootstrap.ts",
			"symlink",
		]);
	});

	test("requires source-managed local skills during verification", () => {
		for (const skillName of localSkillNames) {
			expect(REQUIRED_SKILLS).toContain(skillName);
		}
	});

	test("does not require Superpowers skills during verification", () => {
		expect(REQUIRED_SKILLS).not.toContain("using-superpowers");
		expect(REQUIRED_SKILLS).not.toContain("brainstorming");
	});
});
