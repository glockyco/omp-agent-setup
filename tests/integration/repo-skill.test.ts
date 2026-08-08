import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readlink,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LOCAL_OPTIONAL_SKILLS } from "../../src/optional-skills.ts";
import {
	addExcludeLine,
	classifyRepoSkill,
	isDeployedOptionalSkill,
	planRepoSkillDisable,
	planRepoSkillEnable,
	removeExcludeLine,
	repoSkillExcludeLine,
	repoSkillPath,
} from "../../src/repo-skill.ts";
import {
	applyDisablePlan,
	applyEnablePlan,
	listRepoSkillEntries,
	payloadExists,
	probeRepoSkillEntry,
	updateGitExclude,
} from "../../src/repo-skill-runtime.ts";

const NAME = "simple-english";
const LINE = repoSkillExcludeLine(NAME);

let repo: string;
let payloadDir: string;
let destination: string;

beforeEach(async () => {
	repo = await mkdtemp(join(tmpdir(), "omp-repo-skill-repo-"));
	payloadDir = join(await mkdtemp(join(tmpdir(), "omp-repo-skill-payload-")), NAME);
	await mkdir(payloadDir, { recursive: true });
	await writeFile(join(payloadDir, "SKILL.md"), "name: simple-english\n");
	destination = repoSkillPath(repo, NAME);
	Bun.spawnSync({ cmd: ["git", "init", "-q", repo], stdout: "ignore", stderr: "ignore" });
});

afterEach(async () => {
	await rm(repo, { recursive: true, force: true });
	await rm(join(payloadDir, ".."), { recursive: true, force: true });
});

async function enable(): Promise<string> {
	const plan = planRepoSkillEnable({
		repoRoot: repo,
		name: NAME,
		payloadDir,
		entry: await probeRepoSkillEntry(destination),
	});
	if (plan.kind !== "link") return plan.kind;
	await applyEnablePlan(plan);
	await updateGitExclude(repo, text => addExcludeLine(text, LINE));
	return plan.kind;
}

async function disable(): Promise<string> {
	const plan = planRepoSkillDisable({
		repoRoot: repo,
		name: NAME,
		payloadDir,
		entry: await probeRepoSkillEntry(destination),
	});
	if (plan.kind !== "unlink") return plan.kind;
	await applyDisablePlan(plan);
	await updateGitExclude(repo, text => removeExcludeLine(text, LINE));
	return plan.kind;
}

function readExclude(): Promise<string> {
	return readFile(join(repo, ".git", "info", "exclude"), "utf8");
}

async function status(): Promise<string> {
	return classifyRepoSkill({
		entry: await probeRepoSkillEntry(destination),
		payloadDir,
		payloadExists: await payloadExists(payloadDir),
	});
}

describe("repo-skill opt-in round trip (integration)", () => {
	test("enable links the payload and excludes it from git", async () => {
		expect(await enable()).toBe("link");

		await expect(readlink(destination)).resolves.toBe(payloadDir);
		expect(await readExclude()).toContain(LINE);
		expect(await status()).toBe("enabled");
		// The marker must not show up as untracked working-tree noise.
		const porcelain = Bun.spawnSync({
			cmd: ["git", "-C", repo, "status", "--porcelain"],
			stdout: "pipe",
			stderr: "ignore",
		});
		expect(porcelain.stdout.toString().trim()).toBe("");
	});

	test("enabling twice is a byte-identical no-op", async () => {
		await enable();
		const before = await readExclude();

		expect(await enable()).toBe("skip-already-enabled");

		expect(await readExclude()).toBe(before);
		await expect(readlink(destination)).resolves.toBe(payloadDir);
	});

	test("disable removes the symlink and the exclude line", async () => {
		await enable();

		expect(await disable()).toBe("unlink");

		await expect(lstat(destination)).rejects.toHaveProperty("code", "ENOENT");
		expect(await readExclude()).not.toContain(LINE);
		expect(await status()).toBe("disabled");
		expect(await disable()).toBe("skip-not-enabled");
	});

	test("refuses a foreign entry and leaves it in place", async () => {
		await mkdir(destination, { recursive: true });
		await writeFile(join(destination, "SKILL.md"), "name: mine\n");

		const entry = await probeRepoSkillEntry(destination);
		expect(planRepoSkillEnable({ repoRoot: repo, name: NAME, payloadDir, entry }).kind).toBe(
			"blocked-foreign",
		);
		expect(planRepoSkillDisable({ repoRoot: repo, name: NAME, payloadDir, entry }).kind).toBe(
			"blocked-foreign",
		);
		expect(await status()).toBe("foreign");
		await expect(readFile(join(destination, "SKILL.md"), "utf8")).resolves.toBe("name: mine\n");
	});

	test("a removed payload reports broken and still disables cleanly", async () => {
		await enable();
		await rm(payloadDir, { recursive: true, force: true });

		expect(await status()).toBe("broken");

		expect(await disable()).toBe("unlink");
		await expect(lstat(destination)).rejects.toHaveProperty("code", "ENOENT");
		expect(await readExclude()).not.toContain(LINE);
	});

	test("reports a stranded symlink as an orphan but leaves project-owned skills alone", async () => {
		const deployRoot = join(payloadDir, "..");
		await enable();
		// A payload this registry no longer knows about: exactly what deleting a
		// LOCAL_OPTIONAL_SKILLS entry strands in every repo that opted in.
		const stranded = join(deployRoot, "retired");
		await mkdir(stranded, { recursive: true });
		await symlink(stranded, repoSkillPath(repo, "retired"));
		// And a skill the repository wrote itself, which is none of our business.
		await mkdir(join(repo, ".omp", "skills", "project-owned"), { recursive: true });

		const entries = await listRepoSkillEntries(repo);
		const orphans = entries.filter(
			entry => entry.name !== NAME && isDeployedOptionalSkill(entry.target, deployRoot),
		);

		expect(entries.map(entry => entry.name).sort()).toEqual(["project-owned", "retired", NAME]);
		expect(orphans.map(entry => entry.name)).toEqual(["retired"]);
		expect(LOCAL_OPTIONAL_SKILLS.map(skill => skill.name)).not.toContain("retired");
	});

	test("reports no-git and still enables outside a repository", async () => {
		const plain = await mkdtemp(join(tmpdir(), "omp-repo-skill-nogit-"));
		try {
			const plan = planRepoSkillEnable({
				repoRoot: plain,
				name: NAME,
				payloadDir,
				entry: await probeRepoSkillEntry(repoSkillPath(plain, NAME)),
			});
			if (plan.kind !== "link") throw new Error(`unexpected plan: ${plan.kind}`);
			await applyEnablePlan(plan);

			const result = await updateGitExclude(plain, text => addExcludeLine(text, LINE));

			expect(result).toEqual({ kind: "no-git" });
			await expect(readlink(repoSkillPath(plain, NAME))).resolves.toBe(payloadDir);
		} finally {
			await rm(plain, { recursive: true, force: true });
		}
	});
});
