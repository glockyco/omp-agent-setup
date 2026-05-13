import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	defaultProbe,
	executeSnapshot,
	type FsProbe,
	planSnapshot,
	timestampedBackupDirName,
} from "../src/backup.ts";

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
			{ kind: "copy", source: "/a/file", destination: "/b/run1/a__file", type: "file" },
			{ kind: "copy", source: "/a/dir", destination: "/b/run1/a__dir", type: "directory" },
			{ kind: "copy", source: "/a/link", destination: "/b/run1/a__link", type: "symlink" },
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

		const expectedFile = join(
			backupDir,
			`${fileSrc.slice(1).replaceAll("/", "__").replaceAll(".", "_")}`,
		);
		const expectedLink = join(
			backupDir,
			`${linkSrc.slice(1).replaceAll("/", "__").replaceAll(".", "_")}`,
		);
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

		const destBase = join(backupDir, dirSrc.slice(1).replaceAll("/", "__"));
		await expect(readFile(join(destBase, "a.txt"), "utf8")).resolves.toBe("A\n");
		await expect(readFile(join(destBase, "sub", "b.txt"), "utf8")).resolves.toBe("B\n");
	});
});

describe("timestampedBackupDirName", () => {
	test("formats UTC timestamps deterministically", () => {
		const name = timestampedBackupDirName(new Date(Date.UTC(2026, 4, 13, 9, 7, 5)));
		expect(name).toBe("20260513T090705Z");
	});
});
