import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBootstrap, summarizeReport } from "../../src/bootstrap.ts";
import { MANAGED_CONFIG, readTopLevel } from "../../src/config.ts";

let tempHome: string;
let agentDir: string;
let repoRoot: string;

beforeEach(async () => {
	tempHome = await mkdtemp(join(tmpdir(), "omp-int-home-"));
	agentDir = join(tempHome, ".omp", "agent");
	// Copy the minimum repo surface needed to bootstrap into a sandbox so we
	// don't touch the real ~/.omp/agent.
	repoRoot = await mkdtemp(join(tmpdir(), "omp-int-repo-"));
	await mkdir(join(repoRoot, "agent"), { recursive: true });
	await mkdir(join(repoRoot, "extensions"), { recursive: true });
	await mkdir(join(repoRoot, "manifests"), { recursive: true });
	await writeFile(join(repoRoot, "agent", "AGENTS.md"), "# Stub global AGENTS.md\n");
	await writeFile(join(repoRoot, "agent", "lsp.json"), '{ "servers": {} }\n');
	await mkdir(join(repoRoot, "agent", "skills", "commit"), { recursive: true });
	for (const skillName of [
		"writing-project-readmes",
		"writing-agent-instructions",
		"writing-omp-skills",
	]) {
		await mkdir(join(repoRoot, "agent", "skills", skillName), { recursive: true });
		await writeFile(join(repoRoot, "agent", "skills", skillName, "SKILL.md"), `# ${skillName}\n`);
	}
	await writeFile(
		join(repoRoot, "extensions", "superpowers-bootstrap.ts"),
		"// stub bootstrap extension\n",
	);
	await writeFile(join(repoRoot, "agent", "skills", "commit", "SKILL.md"), "# Commit skill\n");
	// Empty manifest so we don't hit the real Git remotes.
	await writeFile(join(repoRoot, "manifests", "plugins.yml"), "plugins: {}\n");
});

afterEach(async () => {
	await rm(tempHome, { recursive: true, force: true });
	await rm(repoRoot, { recursive: true, force: true });
});

describe("runBootstrap (integration)", () => {
	test("first run deploys symlinks, writes managed config, and reports snapshot", async () => {
		const report = await runBootstrap({ repoRoot, home: tempHome });

		// Managed symlinks point at the repo source.
		await expect(readlink(join(agentDir, "AGENTS.md"))).resolves.toBe(
			join(repoRoot, "agent", "AGENTS.md"),
		);
		await expect(readlink(join(agentDir, "lsp.json"))).resolves.toBe(
			join(repoRoot, "agent", "lsp.json"),
		);
		await expect(readlink(join(agentDir, "extensions", "superpowers-bootstrap.ts"))).resolves.toBe(
			join(repoRoot, "extensions", "superpowers-bootstrap.ts"),
		);
		await expect(readlink(join(agentDir, "skills", "commit"))).resolves.toBe(
			join(repoRoot, "agent", "skills", "commit"),
		);
		for (const skillName of [
			"writing-project-readmes",
			"writing-agent-instructions",
			"writing-omp-skills",
		]) {
			await expect(readlink(join(agentDir, "skills", skillName))).resolves.toBe(
				join(repoRoot, "agent", "skills", skillName),
			);
		}

		// Managed config keys are present.
		const written = await readFile(join(agentDir, "config.yml"), "utf8");
		for (const key of Object.keys(MANAGED_CONFIG)) {
			expect(readTopLevel(written, key)).toEqual(
				MANAGED_CONFIG[key as keyof typeof MANAGED_CONFIG] as unknown,
			);
		}

		// Backup directory exists with a manifest.
		const manifestPath = join(report.backupDir, "manifest.json");
		const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown[];
		expect(manifest.length).toBeGreaterThan(0);

		// Report is summarizable.
		expect(summarizeReport(report)).toContain("Backup directory:");
		expect(report.configChanged).toBe(true);
	});

	test("merges managed Zed settings under ~/.config/zed/settings.json", async () => {
		const zedPath = join(tempHome, ".config", "zed", "settings.json");
		await mkdir(join(tempHome, ".config", "zed"), { recursive: true });
		await writeFile(zedPath, `// user comment\n{ "vim_mode": true }\n`);

		const report = await runBootstrap({
			repoRoot,
			home: tempHome,
			skipPlugins: true,
			skipPatches: true,
			ompPath: "/fake/omp",
		});
		expect(report.zedSettings.changed).toBe(true);
		expect(report.zedSettings.existed).toBe(true);

		const text = await readFile(zedPath, "utf8");
		expect(text).toContain("// user comment");
		expect(text).toContain('"vim_mode": true');
		expect(text).toContain('"omp-acp"');

		const second = await runBootstrap({
			repoRoot,
			home: tempHome,
			skipPlugins: true,
			skipPatches: true,
			ompPath: "/fake/omp",
		});
		expect(second.zedSettings.changed).toBe(false);
	});

	test("second run is idempotent: no config change, symlinks unchanged", async () => {
		await runBootstrap({ repoRoot, home: tempHome });
		const configFirst = await readFile(join(agentDir, "config.yml"), "utf8");

		const second = await runBootstrap({ repoRoot, home: tempHome });
		const configSecond = await readFile(join(agentDir, "config.yml"), "utf8");

		expect(configSecond).toBe(configFirst);
		expect(second.configChanged).toBe(false);
		expect(second.links.entries.every(e => e.kind === "skip")).toBe(true);
	});

	test("preserves unrelated user keys in config.yml", async () => {
		await mkdir(agentDir, { recursive: true });
		await writeFile(
			join(agentDir, "config.yml"),
			"modelRoles:\n  default: anthropic/claude-opus-4-7\nsteeringMode: all\n",
		);
		await runBootstrap({ repoRoot, home: tempHome });
		const written = await readFile(join(agentDir, "config.yml"), "utf8");
		expect(readTopLevel(written, "modelRoles")).toEqual({ default: "anthropic/claude-opus-4-7" });
		expect(readTopLevel(written, "steeringMode")).toBe("all");
		// And managed keys were still applied.
		expect(readTopLevel(written, "skills")).toEqual(MANAGED_CONFIG.skills as unknown);
	});

	test("removes legacy-Pi temp-mirror symlinks from skills dir", async () => {
		const skillsDir = join(agentDir, "skills");
		await mkdir(skillsDir, { recursive: true });
		await symlink(
			"/private/var/folders/xx/T/omp-legacy-pi-file/skills/using-superpowers",
			join(skillsDir, "using-superpowers"),
		);
		await symlink("/tmp/real/skill", join(skillsDir, "keep-me"));

		const report = await runBootstrap({ repoRoot, home: tempHome });

		expect(report.staleSymlinks.entries.map(e => e.path)).toEqual([
			join(skillsDir, "using-superpowers"),
		]);
		await expect(readlink(join(skillsDir, "keep-me"))).resolves.toBe("/tmp/real/skill");
	});

	test("refuses to clobber a real file at a managed destination", async () => {
		await mkdir(agentDir, { recursive: true });
		await writeFile(join(agentDir, "AGENTS.md"), "user-authored content");
		await expect(runBootstrap({ repoRoot, home: tempHome })).rejects.toThrow(
			/Refusing to replace non-symlink/,
		);
	});
});
