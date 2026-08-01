import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { managedAgentChecks, REQUIRED_SKILLS } from "../src/cli.ts";
import { LOCAL_OPTIONAL_SKILLS } from "../src/optional-skills.ts";

describe("update-omp command", () => {
	async function runUpdateCommand(args: string[]) {
		const fakeBin = await mkdtemp(join(tmpdir(), "omp-update-cli-"));
		const marker = join(fakeBin, "omp-invoked");
		const omp = join(fakeBin, "omp");
		await writeFile(omp, `#!/bin/sh\ntouch "${marker}"\nexit 99\n`);
		await chmod(omp, 0o755);
		const result = Bun.spawnSync({
			cmd: [process.execPath, "run", "src/cli.ts", "update-omp", ...args],
			cwd: join(import.meta.dir, ".."),
			env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}` },
			stdout: "pipe",
			stderr: "pipe",
		});
		const invoked = await Bun.file(marker).exists();
		await rm(fakeBin, { recursive: true, force: true });
		return {
			exitCode: result.exitCode,
			stdout: result.stdout.toString(),
			stderr: result.stderr.toString(),
			invoked,
		};
	}

	test("prints only usage for help", async () => {
		const result = await runUpdateCommand(["--help"]);

		expect(result).toEqual({
			exitCode: 0,
			stdout: "usage: bun run update-omp\n",
			stderr: "",
			invoked: false,
		});
	});

	test("rejects unsupported arguments without invoking OMP", async () => {
		const result = await runUpdateCommand(["--force"]);

		expect(result).toEqual({
			exitCode: 2,
			stdout: "",
			stderr: "usage: bun run update-omp\n",
			invoked: false,
		});
	});
});

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

	test("deploys optional skills to the directory OMP never scans", () => {
		const agentDir = "/tmp/omp-agent";
		const checks = managedAgentChecks(agentDir);

		for (const skill of LOCAL_OPTIONAL_SKILLS) {
			expect(checks).toContainEqual([
				join(agentDir, "optional-skills", skill.name),
				`optional-skills/${skill.name}`,
				"symlink",
			]);
			// Deploying the same payload under `skills/` would list it in every
			// session, which is exactly what the opt-in avoids.
			expect(checks).not.toContainEqual([
				join(agentDir, "skills", skill.name),
				`skills/${skill.name}`,
				"symlink",
			]);
		}
	});

	test("never requires an opt-in skill during verification", () => {
		for (const skill of LOCAL_OPTIONAL_SKILLS) {
			expect(REQUIRED_SKILLS).not.toContain(skill.name);
		}
	});
});
