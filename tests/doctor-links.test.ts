import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyManagedCheck, renderImpeccableDoctorLines } from "../src/cli.ts";

let workdir: string;

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "omp-doctor-test-"));
});

afterEach(async () => {
	await rm(workdir, { recursive: true, force: true });
});

describe("renderImpeccableDoctorLines", () => {
	test("renders the exact healthy summary", () => {
		expect(renderImpeccableDoctorLines([], 3)).toEqual([
			"  ok   impeccable content (Pi provider, clean Markdown, 3 vendor fixes)",
		]);
	});

	test("renders every issue followed by one remediation", () => {
		expect(
			renderImpeccableDoctorLines([
				{ kind: "provider", path: "provider.mjs", message: "wrong provider" },
				{ kind: "vendor-fix", path: "context.mjs", message: "fix drift", fixId: "hook" },
			]),
		).toEqual([
			"  WARN impeccable content: wrong provider",
			"  WARN impeccable content: fix drift",
			"       remediation: run bun run update-impeccable; if anchor drift remains, update IMPECCABLE_VENDOR_FIXES",
		]);
	});
});

describe("classifyManagedCheck", () => {
	test("reports a symlink with a resolvable target as healthy", async () => {
		const source = join(workdir, "source.md");
		const link = join(workdir, "link.md");
		await writeFile(source, "payload\n");
		await symlink(source, link);

		expect(await classifyManagedCheck(link, "symlink")).toEqual({
			kind: "ok-symlink",
			target: source,
		});
	});

	test("flags a symlink whose target does not exist", async () => {
		const link = join(workdir, "dangling.md");
		const missing = join(workdir, "never-created.md");
		await symlink(missing, link);

		expect(await classifyManagedCheck(link, "symlink")).toEqual({
			kind: "dangling-symlink",
			target: missing,
		});
	});

	test("flags a dangling symlink even where a plain file is expected", async () => {
		const link = join(workdir, "config.yml");
		await symlink(join(workdir, "gone"), link);

		expect((await classifyManagedCheck(link, "file")).kind).toBe("dangling-symlink");
	});

	test("reports a plain file as healthy when a file is expected", async () => {
		const path = join(workdir, "config.yml");
		await writeFile(path, "key: value\n");

		expect(await classifyManagedCheck(path, "file")).toEqual({ kind: "ok" });
	});

	test("reports a plain file as unhealthy when a symlink is expected", async () => {
		const path = join(workdir, "AGENTS.md");
		await writeFile(path, "not a link\n");

		expect(await classifyManagedCheck(path, "symlink")).toEqual({ kind: "not-symlink" });
	});

	test("reports an absent path as missing", async () => {
		expect(await classifyManagedCheck(join(workdir, "absent"), "symlink")).toEqual({
			kind: "missing",
		});
	});
});
