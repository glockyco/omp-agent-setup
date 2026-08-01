// Pure opt-in logic for optional skills. A repository enables one by placing a
// symlink at `<repo>/.omp/skills/<name>` pointing at the globally deployed
// payload; OMP's native project scan walks every ancestor of the session cwd
// looking for exactly that directory. Nothing here touches the filesystem —
// `repo-skill-runtime.ts` probes and applies.

import { join } from "node:path";

/** What `lstat`/`readlink` found at the repo-local skill path. */
export type RepoSkillEntry = null | { isSymlink: boolean; target: string | null };

export interface RepoSkillInput {
	repoRoot: string;
	name: string;
	/** Absolute `~/.omp/agent/optional-skills/<name>`. */
	payloadDir: string;
	entry: RepoSkillEntry;
}

export type EnablePlan =
	| { kind: "link"; source: string; destination: string }
	| { kind: "skip-already-enabled"; destination: string }
	| { kind: "blocked-foreign"; destination: string; target: string | null };

export type DisablePlan =
	| { kind: "unlink"; destination: string }
	| { kind: "skip-not-enabled"; destination: string }
	| { kind: "blocked-foreign"; destination: string; target: string | null };

/** `<repoRoot>/.omp/skills/<name>` — the path OMP's native project scan reads. */
export function repoSkillPath(repoRoot: string, name: string): string {
	return join(repoRoot, ".omp", "skills", name);
}

/** True when the entry is our own symlink into the deployed payload. */
function isManagedEntry(entry: RepoSkillEntry, payloadDir: string): boolean {
	return entry !== null && entry.isSymlink && entry.target === payloadDir;
}

export function planRepoSkillEnable(input: RepoSkillInput): EnablePlan {
	const destination = repoSkillPath(input.repoRoot, input.name);
	if (input.entry === null) return { kind: "link", source: input.payloadDir, destination };
	if (isManagedEntry(input.entry, input.payloadDir)) {
		return { kind: "skip-already-enabled", destination };
	}
	// Anything else — a foreign symlink, a real directory, a real file — belongs
	// to someone. Same refusal posture as `planManagedLinks`.
	return { kind: "blocked-foreign", destination, target: input.entry.target };
}

export function planRepoSkillDisable(input: RepoSkillInput): DisablePlan {
	const destination = repoSkillPath(input.repoRoot, input.name);
	if (input.entry === null) return { kind: "skip-not-enabled", destination };
	if (isManagedEntry(input.entry, input.payloadDir)) return { kind: "unlink", destination };
	return { kind: "blocked-foreign", destination, target: input.entry.target };
}

export type RepoSkillStatus = "enabled" | "broken" | "foreign" | "disabled";

/**
 * Shared by `omp-skill list` and `omp-skill list --fleet` so both report
 * identically. `broken` is our own symlink whose payload no longer resolves —
 * the state a removed registry entry leaves behind in every repo that opted in.
 */
export function classifyRepoSkill(input: {
	entry: RepoSkillEntry;
	payloadDir: string;
	/** Whether `payloadDir` currently resolves on disk. */
	payloadExists: boolean;
}): RepoSkillStatus {
	if (input.entry === null) return "disabled";
	if (!isManagedEntry(input.entry, input.payloadDir)) return "foreign";
	return input.payloadExists ? "enabled" : "broken";
}

/**
 * True when a repo-local skill entry points into the optional-skills deploy
 * root — i.e. this tool created it. Repositories legitimately keep their own
 * real `.omp/skills/<name>` directories, and those are none of our business:
 * only a symlink we planted can be stranded by a registry deletion. The
 * separator-boundary check keeps a sibling root such as
 * `optional-skills-backup` from matching.
 */
export function isDeployedOptionalSkill(target: string | null, deployRoot: string): boolean {
	return target !== null && target.startsWith(`${deployRoot.replace(/\/+$/, "")}/`);
}

export const EXCLUDE_HEADER = "# omp-skill: repo-local optional skills";

/** gitignore-syntax path anchored to the repo root, e.g. `/.omp/skills/simple-english`. */
export function repoSkillExcludeLine(name: string): string {
	return `/.omp/skills/${name}`;
}

/** Append `line` (and the header, once) unless an identical line already exists. */
export function addExcludeLine(existing: string, line: string): string {
	const lines = existing.split("\n");
	if (lines.some(entry => entry.trim() === line)) return existing;
	const body = existing.replace(/\n+$/, "");
	const parts = body.length > 0 ? [body] : [];
	if (!lines.some(entry => entry.trim() === EXCLUDE_HEADER)) parts.push(EXCLUDE_HEADER);
	parts.push(line);
	return `${parts.join("\n")}\n`;
}

/** Drop `line`, and the header too once no optional-skill line is left. */
export function removeExcludeLine(existing: string, line: string): string {
	const lines = existing.split("\n");
	if (!lines.some(entry => entry.trim() === line)) return existing;
	let kept = lines.filter(entry => entry.trim() !== line);
	if (!kept.some(entry => entry.trim().startsWith("/.omp/skills/"))) {
		kept = kept.filter(entry => entry.trim() !== EXCLUDE_HEADER);
	}
	const body = kept.join("\n").replace(/\n+$/, "");
	return body.length > 0 ? `${body}\n` : "";
}
