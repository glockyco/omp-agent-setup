// Real-IO adapters for `repo-skill.ts`: payload location, destination probing,
// symlink apply, `.git/info/exclude` maintenance, and orphan discovery. The
// decisions live in `repo-skill.ts`; this file only reads and writes.

import type { Stats } from "node:fs";
import {
	lstat,
	mkdir,
	readdir,
	readFile,
	readlink,
	stat,
	symlink,
	unlink,
	writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { DisablePlan, EnablePlan, RepoSkillEntry } from "./repo-skill.ts";

/** Root every deployed optional-skill payload lives under. */
export function optionalSkillsRoot(home = homedir()): string {
	return join(home, ".omp", "agent", "optional-skills");
}

/** `~/.omp/agent/optional-skills/<name>`. */
export function optionalSkillPayloadDir(name: string, home = homedir()): string {
	return join(optionalSkillsRoot(home), name);
}

/** lstat + readlink into a `RepoSkillEntry`; `null` on ENOENT. */
export async function probeRepoSkillEntry(destination: string): Promise<RepoSkillEntry> {
	let entry: Stats;
	try {
		entry = await lstat(destination);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	if (!entry.isSymbolicLink()) return { isSymlink: false, target: null };
	return { isSymlink: true, target: await readlink(destination) };
}

/** Whether the deployed payload resolves — a dangling link makes this false. */
export async function payloadExists(payloadDir: string): Promise<boolean> {
	try {
		await stat(payloadDir);
		return true;
	} catch {
		return false;
	}
}

export async function applyEnablePlan(plan: Extract<EnablePlan, { kind: "link" }>): Promise<void> {
	await mkdir(dirname(plan.destination), { recursive: true });
	await symlink(plan.source, plan.destination);
}

export async function applyDisablePlan(
	plan: Extract<DisablePlan, { kind: "unlink" }>,
): Promise<void> {
	await unlink(plan.destination);
}

export type ExcludeResult = { kind: "no-git" } | { kind: "changed" } | { kind: "unchanged" };

/**
 * Read `<gitDir>/info/exclude`, apply `mutate`, write only when the text
 * changed. `<repoRoot>/.git` is a directory in a normal clone and a file
 * holding `gitdir: <path>` in a worktree or submodule.
 */
export async function updateGitExclude(
	repoRoot: string,
	mutate: (existing: string) => string,
): Promise<ExcludeResult> {
	const gitDir = await resolveGitDir(repoRoot);
	if (gitDir === null) return { kind: "no-git" };
	const infoDir = join(gitDir, "info");
	const excludePath = join(infoDir, "exclude");
	let existing = "";
	try {
		existing = await readFile(excludePath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const next = mutate(existing);
	if (next === existing) return { kind: "unchanged" };
	await mkdir(infoDir, { recursive: true });
	await writeFile(excludePath, next);
	return { kind: "changed" };
}

async function resolveGitDir(repoRoot: string): Promise<string | null> {
	const dotGit = join(repoRoot, ".git");
	let entry: Stats;
	try {
		entry = await stat(dotGit);
	} catch {
		return null;
	}
	if (entry.isDirectory()) return dotGit;
	const pointer = (await readFile(dotGit, "utf8")).trim();
	const prefix = "gitdir:";
	if (!pointer.startsWith(prefix)) return null;
	const target = pointer.slice(prefix.length).trim();
	return target.length > 0 ? join(repoRoot, target) : null;
}

/** One child of `<repoRoot>/.omp/skills`, with its symlink target when it is one. */
export interface RepoSkillDirEntry {
	name: string;
	/** `readlink` result for a symlink (even a dangling one); `null` otherwise. */
	target: string | null;
}

/**
 * Children of `<repoRoot>/.omp/skills`; `[]` on ENOENT. A purely
 * registry-driven scan would go blind to symlinks stranded by a deleted
 * registry entry, so the CLI cross-checks this listing to find orphans. Targets
 * come along because a repo's own real skill directory shares this namespace
 * and must not be mistaken for one of ours.
 */
export async function listRepoSkillEntries(repoRoot: string): Promise<RepoSkillDirEntry[]> {
	const skillsDir = join(repoRoot, ".omp", "skills");
	let names: string[];
	try {
		names = await readdir(skillsDir);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
	const entries: RepoSkillDirEntry[] = [];
	for (const name of names) {
		const probed = await probeRepoSkillEntry(join(skillsDir, name));
		entries.push({ name, target: probed?.target ?? null });
	}
	return entries;
}
