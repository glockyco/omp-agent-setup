import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { lstat, mkdtemp, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	executeLinkPlan,
	executeSymlinkRemoval,
	planManagedLinks,
	planSymlinkRemoval,
} from "../src/runtime.ts";

let workdir: string;

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "omp-runtime-test-"));
});

afterEach(async () => {
	await rm(workdir, { recursive: true, force: true });
});

describe("planManagedLinks", () => {
	test("plans create when destination is missing", async () => {
		const src = join(workdir, "src.ts");
		const dest = join(workdir, "out/dest.ts");
		await writeFile(src, "");
		const plan = await planManagedLinks([{ source: src, destination: dest }]);
		expect(plan.entries).toEqual([{ kind: "create", source: src, destination: dest }]);
	});

	test("plans skip when destination already matches", async () => {
		const src = join(workdir, "src.ts");
		const dest = join(workdir, "dest.ts");
		await writeFile(src, "");
		await symlink(src, dest);
		const plan = await planManagedLinks([{ source: src, destination: dest }]);
		expect(plan.entries[0]?.kind).toBe("skip");
	});

	test("plans update when symlink points elsewhere", async () => {
		const src = join(workdir, "src.ts");
		const dest = join(workdir, "dest.ts");
		await writeFile(src, "");
		await symlink("/elsewhere", dest);
		const plan = await planManagedLinks([{ source: src, destination: dest }]);
		expect(plan.entries[0]).toEqual({
			kind: "update",
			source: src,
			destination: dest,
			previousTarget: "/elsewhere",
		});
	});

	test("plans blocked when a real file occupies the destination", async () => {
		const src = join(workdir, "src.ts");
		const dest = join(workdir, "dest.ts");
		await writeFile(src, "");
		await writeFile(dest, "in the way");
		const plan = await planManagedLinks([{ source: src, destination: dest }]);
		expect(plan.entries[0]).toEqual({
			kind: "blocked",
			reason: "non-symlink-exists",
			destination: dest,
		});
	});

	test("rejects relative paths", async () => {
		await expect(
			planManagedLinks([{ source: "rel/src.ts", destination: "/abs/dest.ts" }]),
		).rejects.toThrow(/absolute paths/);
	});
});

describe("executeLinkPlan", () => {
	test("creates and updates symlinks; skip is idempotent", async () => {
		const src = join(workdir, "src.ts");
		const otherSrc = join(workdir, "src2.ts");
		const dest = join(workdir, "out/dest.ts");
		await writeFile(src, "");
		await writeFile(otherSrc, "");

		await executeLinkPlan(await planManagedLinks([{ source: src, destination: dest }]));
		await expect(readlink(dest)).resolves.toBe(src);

		// Idempotent rerun is a no-op.
		await executeLinkPlan(await planManagedLinks([{ source: src, destination: dest }]));
		await expect(readlink(dest)).resolves.toBe(src);

		// Updating to a different target replaces the link.
		await executeLinkPlan(await planManagedLinks([{ source: otherSrc, destination: dest }]));
		await expect(readlink(dest)).resolves.toBe(otherSrc);
	});

	test("refuses to clobber non-symlinks", async () => {
		const src = join(workdir, "src.ts");
		const dest = join(workdir, "dest.ts");
		await writeFile(src, "");
		await writeFile(dest, "real file");
		const plan = await planManagedLinks([{ source: src, destination: dest }]);
		await expect(executeLinkPlan(plan)).rejects.toThrow(/Refusing to replace non-symlink/);
	});
});

describe("planSymlinkRemoval", () => {
	test("targets only existing symlinks from an explicit removal list", async () => {
		const stale = join(workdir, "stale");
		const missing = join(workdir, "missing");
		const realFile = join(workdir, "real-file");
		await symlink("/old/target", stale);
		await writeFile(realFile, "keep");

		const plan = await planSymlinkRemoval([stale, missing, realFile]);

		expect(plan.entries).toEqual([{ path: stale, target: "/old/target" }]);
		await executeSymlinkRemoval(plan);
		await expect(lstat(stale)).rejects.toHaveProperty("code", "ENOENT");
		await expect(lstat(realFile)).resolves.toBeDefined();
	});
});
