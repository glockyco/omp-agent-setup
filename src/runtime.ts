import { lstat, mkdir, readdir, readlink, symlink, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

/**
 * Pattern that identifies broken legacy-Pi temp-mirror symlinks produced by
 * older Superpowers extension loading under OMP v15. Anything pointing inside
 * `/private/var/.../T/omp-legacy-pi-file/` is stale and must be removed.
 */
const LEGACY_PI_TEMP_PATTERN = /\/omp-legacy-pi-file\//;

export interface ManagedLink {
	/** Absolute source path inside this repository. */
	source: string;
	/** Absolute destination path inside `~/.omp/agent/`. */
	destination: string;
}

type LinkPlanEntry =
	| { kind: "create"; source: string; destination: string }
	| { kind: "update"; source: string; destination: string; previousTarget: string }
	| { kind: "skip"; reason: "up-to-date"; source: string; destination: string }
	| { kind: "blocked"; reason: "non-symlink-exists"; destination: string };

export interface LinkPlan {
	entries: LinkPlanEntry[];
}

/**
 * Decide what to do for each managed symlink without mutating the filesystem.
 * The planner refuses to silently overwrite a real file or directory at the
 * destination; the caller has to delete or move it first.
 */
export async function planManagedLinks(links: readonly ManagedLink[]): Promise<LinkPlan> {
	const entries: LinkPlanEntry[] = [];
	for (const link of links) {
		if (!isAbsolute(link.source) || !isAbsolute(link.destination)) {
			throw new Error(`Managed link must use absolute paths: ${JSON.stringify(link)}`);
		}
		const existing = await safeLstat(link.destination);
		if (!existing) {
			entries.push({ kind: "create", source: link.source, destination: link.destination });
			continue;
		}
		if (!existing.isSymbolicLink()) {
			entries.push({ kind: "blocked", reason: "non-symlink-exists", destination: link.destination });
			continue;
		}
		const previousTarget = await readlink(link.destination);
		if (previousTarget === link.source) {
			entries.push({
				kind: "skip",
				reason: "up-to-date",
				source: link.source,
				destination: link.destination,
			});
		} else {
			entries.push({
				kind: "update",
				source: link.source,
				destination: link.destination,
				previousTarget,
			});
		}
	}
	return { entries };
}

/**
 * Apply a link plan. Always uses absolute targets so the deployed symlinks
 * stay valid regardless of process cwd.
 */
export async function executeLinkPlan(plan: LinkPlan): Promise<void> {
	for (const entry of plan.entries) {
		if (entry.kind === "skip") continue;
		if (entry.kind === "blocked") {
			throw new Error(
				`Refusing to replace non-symlink at ${entry.destination}; remove or move it manually first`,
			);
		}
		await mkdir(dirname(entry.destination), { recursive: true });
		if (entry.kind === "update") {
			await unlink(entry.destination);
		}
		await symlink(entry.source, entry.destination);
	}
}

export interface StaleSymlinkPlan {
	entries: Array<{ path: string; target: string }>;
}

/**
 * Scan a directory of skill stub symlinks and report the ones whose targets
 * match the legacy-Pi temp-mirror pattern. The directory itself is left alone
 * if it does not exist.
 */
export async function planStaleSymlinkRemoval(dir: string): Promise<StaleSymlinkPlan> {
	const entries: StaleSymlinkPlan["entries"] = [];
	let names: string[];
	try {
		names = await readdir(dir);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { entries };
		throw error;
	}
	for (const name of names) {
		const candidate = join(dir, name);
		const stat = await safeLstat(candidate);
		if (!stat?.isSymbolicLink()) continue;
		const target = await readlink(candidate);
		if (LEGACY_PI_TEMP_PATTERN.test(target)) {
			entries.push({ path: candidate, target });
		}
	}
	return { entries };
}

export async function executeStaleSymlinkRemoval(plan: StaleSymlinkPlan): Promise<void> {
	for (const entry of plan.entries) {
		await unlink(entry.path);
	}
}

async function safeLstat(path: string) {
	try {
		return await lstat(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}
