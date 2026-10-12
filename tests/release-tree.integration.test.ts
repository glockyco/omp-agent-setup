import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkReleaseVersion } from "../scripts/check-release-version.ts";
import { CATALOG, PAYLOAD } from "../scripts/release.ts";
import { canonicalScratchRoot } from "../scripts/setup-release-omp.ts";

setDefaultTimeout(30_000);
const repository = join(import.meta.dir, "..");
const scratch: string[] = [];
afterEach(() => {
	for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function candidate(): string {
	const root = canonicalScratchRoot(mkdtempSync(join(tmpdir(), "personal-release-tree-")));
	scratch.push(root);
	cpSync(join(repository, ".omp-plugin"), join(root, ".omp-plugin"), { recursive: true });
	cpSync(join(repository, PAYLOAD), join(root, PAYLOAD), { recursive: true });
	return root;
}
async function editJson(
	path: string,
	edit: (value: Record<string, unknown>) => void,
): Promise<void> {
	const value = await Bun.file(path).json();
	edit(value);
	writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`);
}
async function editEntry(
	root: string,
	edit: (entry: Record<string, unknown>) => void,
): Promise<void> {
	const path = join(root, CATALOG);
	const catalog: { plugins: Record<string, unknown>[] } = await Bun.file(path).json();
	for (const entry of catalog.plugins) edit(entry);
	writeFileSync(path, `${JSON.stringify(catalog, null, "\t")}\n`);
}

function git(cwd: string, ...args: string[]): string {
	const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
	if (result.exitCode !== 0) throw new Error(result.stderr.toString());
	return result.stdout.toString();
}

/** A disposable release with a fixed baseline, independent of the candidate's version. */
function releasedRepository(): string {
	const root = candidate();
	const catalogPath = join(root, CATALOG);
	const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
		plugins: Array<{ version: string }>;
	};
	for (const entry of catalog.plugins) entry.version = "0.2.0";
	writeFileSync(catalogPath, `${JSON.stringify(catalog, null, "\t")}\n`);
	const manifestPath = join(root, PAYLOAD, "package.json");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version: string };
	manifest.version = "0.2.0";
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	git(root, "init", "-q", "-b", "main");
	git(root, "config", "user.name", "Release Test");
	git(root, "config", "user.email", "release@example.test");
	git(root, "add", ".");
	git(root, "commit", "-q", "-m", "release");
	git(root, "branch", "released");
	return root;
}

async function setVersion(root: string, version: string): Promise<void> {
	await editEntry(root, entry => {
		entry.version = version;
	});
	await editJson(join(root, PAYLOAD, "package.json"), manifest => {
		manifest.version = version;
	});
}

describe("release version signal", () => {
	test("documentation-only changes need no bump", () => {
		const root = releasedRepository();
		writeFileSync(join(root, "README.md"), "docs\n");
		expect(checkReleaseVersion(root, "released").ok).toBe(true);
	});

	test("a runtime change without a newer version fails", () => {
		const root = releasedRepository();
		writeFileSync(join(root, PAYLOAD, "rules", "personal-policy.md"), "changed\n");
		const result = checkReleaseVersion(root, "released");
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/release version stays/);
	});

	test("an untracked payload file counts as a runtime change", () => {
		const root = releasedRepository();
		writeFileSync(join(root, PAYLOAD, "rules", "new-rule.md"), "new\n");
		expect(checkReleaseVersion(root, "released").ok).toBe(false);
	});

	test("a catalog delivery change without a newer version fails", async () => {
		const root = releasedRepository();
		await editEntry(root, entry => {
			entry.strict = true;
		});
		const result = checkReleaseVersion(root, "released");
		expect(result.ok).toBe(false);
		expect(result.message).toMatch(/catalog delivery fields changed/);
	});

	test("an older version fails and a newer matching version passes", async () => {
		const root = releasedRepository();
		// Pin the base so that the test does not depend on the current release.
		await setVersion(root, "1.4.0");
		git(root, "commit", "-q", "-am", "base release");
		git(root, "branch", "-f", "released");
		writeFileSync(join(root, PAYLOAD, "rules", "personal-policy.md"), "changed\n");
		await setVersion(root, "1.3.9");
		expect(checkReleaseVersion(root, "released").ok).toBe(false);
		await setVersion(root, "1.4.1");
		expect(checkReleaseVersion(root, "released")).toMatchObject({ ok: true });
	});

	test("an unknown base fails instead of passing", () => {
		const root = releasedRepository();
		expect(checkReleaseVersion(root, "missing-ref").ok).toBe(false);
	});
});
