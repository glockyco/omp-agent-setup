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
 *
 * Millisecond precision is load-bearing, not decoration: the name is the only
 * thing keeping two snapshots apart, and `executeSnapshot` writes both the
 * copied files and a `manifest.json` into whatever directory it is handed. Two
 * bootstraps inside the same second would otherwise interleave their contents
 * under one name and leave a manifest describing only the second run.
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
		`${pad(date.getUTCMilliseconds(), 3)}` +
		`Z`
	);
}

/**
 * Keep twenty snapshots: at the observed bootstrap cadence this preserves
 * months of recovery history without letting the gitignored directory grow
 * without bound.
 */
export const BACKUP_RETENTION_LIMIT = 20;

/** Deterministic retention decision, kept separate from filesystem mutation. */
export interface BackupRetentionPlan {
	toDelete: string[];
	toKeep: string[];
}

const TIMESTAMPED_BACKUP_NAME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})?Z$/;

type TimestampedName = { name: string; timestamp: number };

function parseTimestampedBackupName(name: string): TimestampedName | null {
	const match = TIMESTAMPED_BACKUP_NAME.exec(name);
	if (!match) return null;
	const [, year, month, day, hour, minute, second, millisecond = "0"] = match;
	const date = new Date(0);
	date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
	date.setUTCHours(Number(hour), Number(minute), Number(second), Number(millisecond));
	if (
		date.getUTCFullYear() !== Number(year) ||
		date.getUTCMonth() !== Number(month) - 1 ||
		date.getUTCDate() !== Number(day) ||
		date.getUTCHours() !== Number(hour) ||
		date.getUTCMinutes() !== Number(minute) ||
		date.getUTCSeconds() !== Number(second) ||
		date.getUTCMilliseconds() !== Number(millisecond)
	) {
		return null;
	}
	return { name, timestamp: date.getTime() };
}

function compareNewestFirst(a: TimestampedName, b: TimestampedName): number {
	if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
	return a.name < b.name ? 1 : a.name > b.name ? -1 : 0;
}

/**
 * Plan retention without consulting filesystem metadata. Plain UTC timestamp
 * names are ordered by their decoded timestamp (newest first); ties use a
 * code-point name comparison. Tagged and unknown-shaped names are always kept.
 * The current run is always kept, even when it consumes a slot beyond the
 * requested limit, so a just-written recovery point cannot be pruned.
 */
export function planBackupRetention(
	snapshotNames: readonly string[],
	retentionLimit: number,
	currentSnapshotName: string,
): BackupRetentionPlan {
	if (!Number.isInteger(retentionLimit) || retentionLimit < 0) {
		throw new RangeError(
			`Backup retention limit must be a non-negative integer, got ${retentionLimit}`,
		);
	}

	const uniqueNames = [...new Set(snapshotNames)];
	const timestamped = uniqueNames
		.map(name => parseTimestampedBackupName(name))
		.filter((entry): entry is TimestampedName => entry !== null)
		.sort(compareNewestFirst);
	const currentIsPresent = uniqueNames.includes(currentSnapshotName);
	const currentTimestamp = currentIsPresent ? parseTimestampedBackupName(currentSnapshotName) : null;
	const keepNames = new Set<string>();
	if (currentIsPresent) keepNames.add(currentSnapshotName);
	const timestampedLimit = currentTimestamp ? Math.max(retentionLimit, 1) : retentionLimit;
	let keptTimestampedCount = currentTimestamp ? 1 : 0;
	for (const entry of timestamped) {
		if (keepNames.has(entry.name)) continue;
		if (keptTimestampedCount >= timestampedLimit) break;
		keepNames.add(entry.name);
		keptTimestampedCount++;
	}

	const toDelete = timestamped
		.filter(entry => !keepNames.has(entry.name))
		.sort((a, b) => a.timestamp - b.timestamp || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		.map(entry => entry.name);
	const toDeleteSet = new Set(toDelete);
	const toKeep = uniqueNames
		.filter(name => !toDeleteSet.has(name))
		.sort((a, b) => {
			const aTimestamp = parseTimestampedBackupName(a);
			const bTimestamp = parseTimestampedBackupName(b);
			if (aTimestamp && bTimestamp) return compareNewestFirst(aTimestamp, bTimestamp);
			if (aTimestamp) return -1;
			if (bTimestamp) return 1;
			return a < b ? -1 : a > b ? 1 : 0;
		});
	return { toDelete, toKeep };
}
