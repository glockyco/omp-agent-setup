import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, lstat, mkdir, mkdtemp, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type BinState, planBinLink } from "../src/bin-link.ts";
import {
	executeBinLink,
	probeBinState,
	resolveBunBinPath,
	resolveOmpSourceEntry,
} from "../src/bin-link-runtime.ts";

const BIN = "/home/u/.bun/bin/omp";
const SRC = "/home/u/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/cli.ts";
const DIST = "/home/u/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/dist/cli.js";

function plan(current: BinState, sourceUsable = true) {
	return planBinLink({ binPath: BIN, desiredTarget: SRC, current, sourceUsable });
}

describe("planBinLink", () => {
	test("skips without mutating when the source entry is unusable", () => {
		// Even though the bin points at the bundle, we must not strand omp on a
		// symlink to a missing or non-executable source. Leave the dist bin alone.
		expect(plan({ kind: "symlink", target: DIST }, false)).toEqual({
			kind: "skip-source-unusable",
			target: SRC,
		});
	});

	test("creates the symlink when the bin is missing", () => {
		expect(plan({ kind: "missing" })).toEqual({ kind: "create", target: SRC });
	});

	test("is a no-op when the bin already points at the source (absolute target)", () => {
		expect(plan({ kind: "symlink", target: SRC })).toEqual({
			kind: "skip-up-to-date",
			target: SRC,
		});
	});

	test("is a no-op when a relative symlink resolves to the source", () => {
		const relative = "../install/global/node_modules/@oh-my-pi/pi-coding-agent/src/cli.ts";
		expect(plan({ kind: "symlink", target: relative })).toEqual({
			kind: "skip-up-to-date",
			target: SRC,
		});
	});

	test("repoints when the bin symlink points at the bundle (bun default)", () => {
		const relativeDist = "../install/global/node_modules/@oh-my-pi/pi-coding-agent/dist/cli.js";
		expect(plan({ kind: "symlink", target: relativeDist })).toEqual({
			kind: "repoint",
			target: SRC,
			previousTarget: relativeDist,
			previousWasSymlink: true,
		});
	});

	test("repoints (after backup) when a real file occupies the bin path", () => {
		expect(plan({ kind: "file" })).toEqual({
			kind: "repoint",
			target: SRC,
			previousTarget: null,
			previousWasSymlink: false,
		});
	});

	test("refuses to touch a directory at the bin path", () => {
		expect(plan({ kind: "directory" })).toEqual({
			kind: "blocked",
			reason: "non-symlink-directory",
		});
	});

	test("rejects a non-absolute desired target", () => {
		expect(() =>
			planBinLink({
				binPath: BIN,
				desiredTarget: "relative/cli.ts",
				current: { kind: "missing" },
				sourceUsable: true,
			}),
		).toThrow(/absolute/);
	});
});

describe("resolveBunBinPath", () => {
	test("uses $BUN_INSTALL when set", () => {
		expect(resolveBunBinPath({ BUN_INSTALL: "/opt/bun" }, "/home/u")).toBe("/opt/bun/bin/omp");
	});

	test("falls back to ~/.bun when unset", () => {
		expect(resolveBunBinPath({}, "/home/u")).toBe("/home/u/.bun/bin/omp");
	});
});

describe("resolveOmpSourceEntry", () => {
	test("targets pi-coding-agent/src/cli.ts under the scope root", () => {
		expect(resolveOmpSourceEntry("/scope")).toBe("/scope/pi-coding-agent/src/cli.ts");
	});
});

describe("executeBinLink (filesystem-backed)", () => {
	let workdir: string;
	let binPath: string;
	let sourceEntry: string;
	let bundleRelative: string;

	beforeEach(async () => {
		workdir = await mkdtemp(join(tmpdir(), "omp-binlink-"));
		binPath = join(workdir, "bin", "omp");
		sourceEntry = join(workdir, "pkg", "pi-coding-agent", "src", "cli.ts");
		bundleRelative = "../pkg/pi-coding-agent/dist/cli.js";
		await mkdir(dirname(binPath), { recursive: true });
		await mkdir(dirname(sourceEntry), { recursive: true });
		await writeFile(sourceEntry, "#!/usr/bin/env bun\n");
		await chmod(sourceEntry, 0o755);
	});

	afterEach(async () => {
		await rm(workdir, { recursive: true, force: true });
	});

	test("repoints a bun-default symlink to the source entry", async () => {
		await symlink(bundleRelative, binPath);
		const result = await executeBinLink(binPath, sourceEntry);
		expect(result.plan.kind).toBe("repoint");
		expect(await readlink(binPath)).toBe(sourceEntry);
		// Still a symlink, never overwritten as a regular file.
		expect((await lstat(binPath)).isSymbolicLink()).toBe(true);
	});

	test("is idempotent on a second run", async () => {
		await symlink(bundleRelative, binPath);
		await executeBinLink(binPath, sourceEntry);
		const second = await executeBinLink(binPath, sourceEntry);
		expect(second.plan.kind).toBe("skip-up-to-date");
		expect(await readlink(binPath)).toBe(sourceEntry);
	});

	test("creates the symlink when the bin is missing", async () => {
		const result = await executeBinLink(binPath, sourceEntry);
		expect(result.plan.kind).toBe("create");
		expect(await readlink(binPath)).toBe(sourceEntry);
	});

	test("leaves the bin untouched when the source entry is missing", async () => {
		await symlink(bundleRelative, binPath);
		await rm(sourceEntry);
		const result = await executeBinLink(binPath, sourceEntry);
		expect(result.plan.kind).toBe("skip-source-unusable");
		// The existing bundle bin must survive so omp keeps running.
		expect(await readlink(binPath)).toBe(bundleRelative);
	});

	test("leaves the bin untouched when the source entry is not executable", async () => {
		await symlink(bundleRelative, binPath);
		await chmod(sourceEntry, 0o644);
		const result = await executeBinLink(binPath, sourceEntry);
		expect(result.plan.kind).toBe("skip-source-unusable");
		expect(await readlink(binPath)).toBe(bundleRelative);
	});

	test("probeBinState reports a real file at the bin path", async () => {
		await writeFile(binPath, "shim");
		expect(await probeBinState(binPath)).toEqual({ kind: "file" });
	});
});
