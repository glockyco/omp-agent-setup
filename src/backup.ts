import { lstat, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { backupSafeName, isPathInside } from "./paths.ts";

/**
 * Per-entry plan for a snapshot. The planner reports what it would do for
 * every requested path, so callers and tests can inspect intent without
 * mutating the filesystem.
 */
type SnapshotEntryPlan =
	| { kind: "skip"; reason: "missing"; source: string }
	| { kind: "copy"; source: string; destination: string; type: "file" | "directory" | "symlink" };

export interface SnapshotPlan {
	backupDir: string;
	entries: SnapshotEntryPlan[];
}

export interface FsProbe {
	/**
	 * Returns the kind of filesystem object at `path`, or `null` if the path
	 * does not exist. Implementations MUST use lstat semantics so that
	 * symlinks are reported as `symlink`, not the type of their target.
	 */
	probe(path: string): Promise<"file" | "directory" | "symlink" | null>;
}

export const defaultProbe: FsProbe = {
	async probe(path) {
		try {
			const stat = await lstat(path);
			if (stat.isSymbolicLink()) return "symlink";
			if (stat.isDirectory()) return "directory";
			if (stat.isFile()) return "file";
			return null;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
			throw error;
		}
	},
};

/**
 * Plan a snapshot of the given source paths into `backupDir`. Pure with
 * respect to the filesystem aside from probing, so tests can assert on the
 * full plan before any mutation occurs.
 */
export async function planSnapshot(
	sources: readonly string[],
	backupDir: string,
	probe: FsProbe = defaultProbe,
): Promise<SnapshotPlan> {
	const entries: SnapshotEntryPlan[] = [];
	for (const source of sources) {
		const kind = await probe.probe(source);
		if (kind === null) {
			entries.push({ kind: "skip", reason: "missing", source });
			continue;
		}
		entries.push({
			kind: "copy",
			source,
			destination: `${backupDir}/${backupSafeName(source)}`,
			type: kind,
		});
	}
	return { backupDir, entries };
}

/**
 * Execute a snapshot plan. Files and symlinks are copied verbatim; symlinks
 * are preserved (the backup contains a symlink with the same target, not a
 * dereferenced copy). Directories are snapshotted recursively as a tar-style
 * mirror via Bun's filesystem APIs.
 *
 * The executor refuses to write outside `plan.backupDir` as a defensive
 * invariant, even though `planSnapshot` already enforces that.
 */
export async function executeSnapshot(plan: SnapshotPlan): Promise<void> {
	await mkdir(plan.backupDir, { recursive: true });
	for (const entry of plan.entries) {
		if (entry.kind === "skip") continue;
		if (!isPathInside(plan.backupDir, entry.destination)) {
			throw new Error(
				`Refusing to write snapshot destination outside backupDir: ${entry.destination}`,
			);
		}
		await mkdir(dirname(entry.destination), { recursive: true });
		if (entry.type === "symlink") {
			const { readlink } = await import("node:fs/promises");
			const target = await readlink(entry.source);
			await symlink(target, entry.destination);
		} else if (entry.type === "file") {
			const contents = await readFile(entry.source);
			await writeFile(entry.destination, contents);
		} else if (entry.type === "directory") {
			await copyDirectory(entry.source, entry.destination);
		}
	}
	const manifest = plan.entries.map(entry =>
		entry.kind === "skip"
			? { kind: entry.kind, source: entry.source, reason: entry.reason }
			: { kind: entry.kind, source: entry.source, destination: entry.destination, type: entry.type },
	);
	await writeFile(`${plan.backupDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function copyDirectory(source: string, destination: string): Promise<void> {
	const { readdir } = await import("node:fs/promises");
	await mkdir(destination, { recursive: true });
	const entries = await readdir(source, { withFileTypes: true });
	for (const entry of entries) {
		const childSource = `${source}/${entry.name}`;
		const childDestination = `${destination}/${entry.name}`;
		if (entry.isSymbolicLink()) {
			const { readlink } = await import("node:fs/promises");
			const target = await readlink(childSource);
			await symlink(target, childDestination);
		} else if (entry.isDirectory()) {
			await copyDirectory(childSource, childDestination);
		} else if (entry.isFile()) {
			const contents = await readFile(childSource);
			await writeFile(childDestination, contents);
		}
	}
}

/**
 * Generate a UTC timestamp directory name suitable for `backups/<name>` so the
 * caller can choose where each snapshot lives.
 */
export function timestampedBackupDirName(date: Date = new Date()): string {
	const pad = (n: number, w = 2) => String(n).padStart(w, "0");
	return (
		`${date.getUTCFullYear()}` +
		`${pad(date.getUTCMonth() + 1)}` +
		`${pad(date.getUTCDate())}` +
		`T` +
		`${pad(date.getUTCHours())}` +
		`${pad(date.getUTCMinutes())}` +
		`${pad(date.getUTCSeconds())}` +
		`Z`
	);
}
