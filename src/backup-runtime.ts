import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { BACKUP_RETENTION_LIMIT, type BackupRetentionPlan, planBackupRetention } from "./backup.ts";

/** Filesystem operations needed by backup retention, injected for deterministic tests. */
export interface BackupRetentionIo {
	listSnapshotNames(backupRoot: string): Promise<readonly string[]>;
	removeSnapshot(backupRoot: string, name: string): Promise<void>;
}

/** A failed removal is reported but never aborts the rest of retention cleanup. */
interface BackupRetentionFailure {
	name: string;
	error: unknown;
}

/** Retention decision plus the removals and failures observed while applying it. */
export interface BackupRetentionResult extends BackupRetentionPlan {
	deleted: string[];
	failures: BackupRetentionFailure[];
}

/** Production filesystem adapter for listing and removing snapshot directories. */
export const realBackupRetentionIo: BackupRetentionIo = {
	async listSnapshotNames(backupRoot) {
		try {
			const entries = await readdir(backupRoot, { withFileTypes: true });
			return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
			throw error;
		}
	},
	async removeSnapshot(backupRoot, name) {
		await rm(join(backupRoot, name), { recursive: true, force: false });
	},
};

/**
 * Apply a pure retention plan to the backup directory. Each removal is
 * independent so a permission or busy-file error is surfaced in the result
 * while later snapshots still get a chance to be deleted.
 */
export async function pruneBackups(
	backupRoot: string,
	currentSnapshotName: string,
	retentionLimit: number = BACKUP_RETENTION_LIMIT,
	io: BackupRetentionIo = realBackupRetentionIo,
): Promise<BackupRetentionResult> {
	let snapshotNames: readonly string[];
	try {
		snapshotNames = await io.listSnapshotNames(backupRoot);
	} catch (error) {
		return { toDelete: [], toKeep: [], deleted: [], failures: [{ name: backupRoot, error }] };
	}
	const plan = planBackupRetention(snapshotNames, retentionLimit, currentSnapshotName);
	const deleted: string[] = [];
	const failures: BackupRetentionFailure[] = [];
	for (const name of plan.toDelete) {
		try {
			await io.removeSnapshot(backupRoot, name);
			deleted.push(name);
		} catch (error) {
			failures.push({ name, error });
		}
	}
	return { ...plan, deleted, failures };
}
