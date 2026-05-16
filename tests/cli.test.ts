import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkZedSettings, managedAgentChecks, REQUIRED_SKILLS } from "../src/cli.ts";

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

describe("checkZedSettings", () => {
	let home: string;
	const FAKE_OMP = "/fake/omp";

	beforeEach(async () => {
		home = await mkdtemp(join(tmpdir(), "omp-zed-cli-"));
		await mkdir(join(home, ".config", "zed"), { recursive: true });
	});

	afterEach(async () => {
		await rm(home, { recursive: true, force: true });
	});

	test("reports missing when settings.json absent", async () => {
		const line = await checkZedSettings({ home, ompPath: FAKE_OMP });
		expect(line).toMatch(/^Zed settings: missing/);
	});

	test("reports ok when omp-acp matches canonical", async () => {
		await writeFile(
			join(home, ".config", "zed", "settings.json"),
			`{ "agent_servers": { "omp-acp": { "type": "custom", "command": "/fake/omp", "args": ["acp"] } } }\n`,
		);
		const line = await checkZedSettings({ home, ompPath: FAKE_OMP });
		expect(line).toMatch(/^Zed settings: ok/);
	});

	test("reports drift when omp-acp args differ", async () => {
		await writeFile(
			join(home, ".config", "zed", "settings.json"),
			`{ "agent_servers": { "omp-acp": { "type": "custom", "command": "/fake/omp", "args": ["acp", "--extra"] } } }\n`,
		);
		const line = await checkZedSettings({ home, ompPath: FAKE_OMP });
		expect(line).toMatch(/^Zed settings: drift/);
	});

	test("reports missing omp-acp entry when agent_servers lacks it", async () => {
		await writeFile(
			join(home, ".config", "zed", "settings.json"),
			`{ "agent_servers": { "claude-acp": { "type": "registry" } } }\n`,
		);
		const line = await checkZedSettings({ home, ompPath: FAKE_OMP });
		expect(line).toMatch(/^Zed settings: missing omp-acp/);
	});

	test("reports parse error when settings.json is malformed", async () => {
		await writeFile(join(home, ".config", "zed", "settings.json"), `{ broken`);
		const line = await checkZedSettings({ home, ompPath: FAKE_OMP });
		expect(line).toMatch(/^Zed settings: parse error/);
	});
});
