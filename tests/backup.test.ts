import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	BACKUP_RETENTION_LIMIT,
	defaultProbe,
	executeSnapshot,
	type FsProbe,
	planBackupRetention,
	planSnapshot,
	timestampedBackupDirName,
} from "../src/backup.ts";
import { type BackupRetentionIo, pruneBackups } from "../src/backup-runtime.ts";
import { backupSafeName } from "../src/paths.ts";

let workdir: string;

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "omp-backup-test-"));
});

afterEach(async () => {
	await rm(workdir, { recursive: true, force: true });
});

const stubProbe = (mapping: Record<string, "file" | "directory" | "symlink" | null>): FsProbe => ({
	async probe(path) {
		return mapping[path] ?? null;
	},
});

describe("planSnapshot", () => {
	test("classifies present, absent, file, dir, symlink entries", async () => {
		const probe = stubProbe({
			"/a/file": "file",
			"/a/dir": "directory",
			"/a/link": "symlink",
			"/a/missing": null,
		});
		const plan = await planSnapshot(["/a/file", "/a/dir", "/a/link", "/a/missing"], "/b/run1", probe);
		expect(plan.entries).toEqual([
			{
				kind: "copy",
				source: "/a/file",
				destination: `/b/run1/${backupSafeName("/a/file")}`,
				type: "file",
			},
			{
				kind: "copy",
				source: "/a/dir",
				destination: `/b/run1/${backupSafeName("/a/dir")}`,
				type: "directory",
			},
			{
				kind: "copy",
				source: "/a/link",
				destination: `/b/run1/${backupSafeName("/a/link")}`,
				type: "symlink",
			},
			{ kind: "skip", reason: "missing", source: "/a/missing" },
		]);
	});
});

describe("executeSnapshot", () => {
	test("snapshots files, symlinks, and skips missing entries", async () => {
		const fileSrc = join(workdir, "source.txt");
		await writeFile(fileSrc, "hello\n");
		const linkSrc = join(workdir, "link.txt");
		await symlink("source.txt", linkSrc);
		const missingSrc = join(workdir, "missing");
		const backupDir = join(workdir, "backups/run1");

		const plan = await planSnapshot([fileSrc, linkSrc, missingSrc], backupDir, defaultProbe);
		await executeSnapshot(plan);

		const expectedFile = join(backupDir, backupSafeName(fileSrc));
		const expectedLink = join(backupDir, backupSafeName(linkSrc));
		await expect(readFile(expectedFile, "utf8")).resolves.toBe("hello\n");
		await expect(readlink(expectedLink)).resolves.toBe("source.txt");

		const manifest = JSON.parse(await readFile(join(backupDir, "manifest.json"), "utf8"));
		expect(manifest).toHaveLength(3);
		expect(manifest[0]).toMatchObject({ kind: "copy", type: "file" });
		expect(manifest[1]).toMatchObject({ kind: "copy", type: "symlink" });
		expect(manifest[2]).toMatchObject({ kind: "skip", reason: "missing" });
	});

	test("recursively snapshots directories", async () => {
		const dirSrc = join(workdir, "tree");
		await mkdir(join(dirSrc, "sub"), { recursive: true });
		await writeFile(join(dirSrc, "a.txt"), "A\n");
		await writeFile(join(dirSrc, "sub", "b.txt"), "B\n");
		const backupDir = join(workdir, "backups/run2");

		const plan = await planSnapshot([dirSrc], backupDir);
		await executeSnapshot(plan);

		const destBase = join(backupDir, backupSafeName(dirSrc));
		await expect(readFile(join(destBase, "a.txt"), "utf8")).resolves.toBe("A\n");
		await expect(readFile(join(destBase, "sub", "b.txt"), "utf8")).resolves.toBe("B\n");
	});
});

describe("planBackupRetention", () => {
	const oldest = "20260513T133313000Z";
	const older = "20260514T133313000Z";
	const newer = "20260515T133313000Z";
	const newest = "20260516T133313000Z";
	const names = [oldest, older, newer, newest];

	test("keeps newest timestamped snapshots and deletes oldest first", () => {
		expect(planBackupRetention(names, 2, newest)).toEqual({
			toDelete: [oldest, older],
			toKeep: [newest, newer],
		});
	});

	test("does nothing at the retention limit", () => {
		expect(planBackupRetention(names, names.length, newest)).toEqual({
			toDelete: [],
			toKeep: [newest, newer, older, oldest],
		});
	});

	test("orders legacy second-precision timestamp names by encoded time", () => {
		const legacyOldest = "20260513T133313Z";
		const legacyOlder = "20260514T133313Z";
		const legacyNewest = "20260515T133313Z";
		const legacyNames = [legacyOldest, legacyOlder, legacyNewest];
		expect(planBackupRetention(legacyNames, 1, legacyNewest)).toEqual({
			toDelete: [legacyOldest, legacyOlder],
			toKeep: [legacyNewest],
		});
	});

	test("preserves tagged and unknown-shaped names", () => {
		const tagged = "20260513T133313Z-pre-cleanup";
		const unknown = "notes-from-a-human";
		expect(planBackupRetention([...names, tagged, unknown], 1, newest)).toEqual({
			toDelete: [oldest, older, newer],
			toKeep: [newest, tagged, unknown],
		});
	});

	test("preserves the current run even when it is older than retained snapshots", () => {
		expect(planBackupRetention(names, 2, oldest)).toEqual({
			toDelete: [older, newer],
			toKeep: [newest, oldest],
		});
	});

	test("uses the named default retention limit", () => {
		expect(BACKUP_RETENTION_LIMIT).toBe(20);
	});
});

describe("pruneBackups", () => {
	test("continues after a snapshot deletion fails", async () => {
		const oldest = "20260513T133313000Z";
		const older = "20260514T133313000Z";
		const newest = "20260515T133313000Z";
		const names = [oldest, older, newest];
		const deleted: string[] = [];
		const io: BackupRetentionIo = {
			async listSnapshotNames() {
				return names;
			},
			async removeSnapshot(_root, name) {
				if (name === oldest) throw new Error("busy");
				deleted.push(name);
			},
		};
		const result = await pruneBackups("/backups", newest, 1, io);
		expect(deleted).toEqual([older]);
		expect(result.deleted).toEqual([older]);
		expect(result.failures.map(failure => failure.name)).toEqual([oldest]);
	});
});

describe("timestampedBackupDirName", () => {
	test("formats UTC timestamps deterministically", () => {
		const name = timestampedBackupDirName(new Date(Date.UTC(2026, 4, 13, 9, 7, 5, 123)));
		expect(name).toBe("20260513T090705123Z");
	});

	test("zero-pads sub-second precision to three digits", () => {
		const name = timestampedBackupDirName(new Date(Date.UTC(2026, 4, 13, 9, 7, 5, 7)));
		expect(name).toBe("20260513T090705007Z");
	});

	test("separates snapshots taken one millisecond apart", () => {
		const base = Date.UTC(2026, 4, 13, 9, 7, 5, 400);
		expect(timestampedBackupDirName(new Date(base))).not.toBe(
			timestampedBackupDirName(new Date(base + 1)),
		);
	});
});
