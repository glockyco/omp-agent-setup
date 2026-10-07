import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkReleaseVersion } from "../scripts/check-release-version.ts";
import { CATALOG, PAYLOAD, validateReleaseTree } from "../scripts/release.ts";

const repository = join(import.meta.dir, "..");
const scratch: string[] = [];

afterEach(() => {
	for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** Copies the candidate release tree (catalog plus payload) into a disposable root. */
function candidate(): string {
	const root = mkdtempSync(join(tmpdir(), "personal-release-tree-"));
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

/** Edits the personal catalog entry of a candidate release in place. */
async function editEntry(
	root: string,
	edit: (entry: Record<string, unknown>) => void,
): Promise<void> {
	const path = join(root, CATALOG);
	const catalog: { plugins: Record<string, unknown>[] } = await Bun.file(path).json();
	for (const entry of catalog.plugins) edit(entry);
	writeFileSync(path, `${JSON.stringify(catalog, null, "\t")}\n`);
}

describe("release tree", () => {
	test("the repository's candidate release is complete", () => {
		expect(validateReleaseTree(repository)).toEqual([]);
	});

	test.each([
		["malformed catalog", (root: string) => writeFileSync(join(root, CATALOG), "{"), /unreadable/],
		[
			"catalog without LSP delivery",
			(root: string) =>
				editEntry(root, entry => {
					delete entry.lspServers;
				}),
			/LSP overrides would be lost/,
		],
		[
			"mismatched payload version",
			(root: string) =>
				editJson(join(root, PAYLOAD, "package.json"), manifest => {
					manifest.version = "9.9.9";
				}),
			/differs from catalog version/,
		],
		[
			"missing extension entry",
			(root: string) =>
				editJson(join(root, PAYLOAD, "package.json"), manifest => {
					manifest.omp = { extensions: ["./extensions/personal-commit.ts"] };
				}),
			/extension entry missing: \.\/extensions\/plannotator\.ts/,
		],
		[
			"missing extension module",
			(root: string) => rmSync(join(root, PAYLOAD, "extensions", "plannotator.ts")),
			/extension module missing/,
		],
		[
			"missing command",
			(root: string) => rmSync(join(root, PAYLOAD, "commands", "opsx-apply.md")),
			/command missing: opsx-apply/,
		],
		[
			"missing skill",
			(root: string) => rmSync(join(root, PAYLOAD, "skills", "commit-policy"), { recursive: true }),
			/skill missing: commit-policy/,
		],
		[
			"missing skill asset",
			(root: string) =>
				rmSync(
					join(root, PAYLOAD, "skills", "research-paper-writing", "references", "introduction.md"),
				),
			/skill asset missing/,
		],
		[
			"non-executable helper",
			(root: string) =>
				chmodSync(join(root, PAYLOAD, "skills", "research-evidence", "scripts", "fetch_pdf.py"), 0o644),
			/not executable/,
		],
		[
			"missing rule",
			(root: string) => rmSync(join(root, PAYLOAD, "rules", "personal-policy.md")),
			/rule missing/,
		],
		[
			"development files in the payload",
			(root: string) => {
				mkdirSync(join(root, PAYLOAD, "tests"));
				writeFileSync(join(root, PAYLOAD, "tests", "x.test.ts"), "");
			},
			/development file inside the payload/,
		],
	])("rejects %s", async (_name, mutate, finding) => {
		const root = candidate();
		await mutate(root);
		expect(validateReleaseTree(root).join("\n")).toMatch(finding);
	});
});

function git(cwd: string, ...args: string[]): string {
	const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
	if (result.exitCode !== 0) throw new Error(result.stderr.toString());
	return result.stdout.toString();
}

/** A disposable repository whose first commit is the current candidate release. */
function releasedRepository(): string {
	const root = candidate();
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
		writeFileSync(join(root, PAYLOAD, "rules", "personal-policy.md"), "changed\n");
		await setVersion(root, "0.1.9");
		expect(checkReleaseVersion(root, "released").ok).toBe(false);
		await setVersion(root, "0.2.1");
		expect(checkReleaseVersion(root, "released")).toMatchObject({ ok: true });
	});

	test("an unknown base fails instead of passing", () => {
		const root = releasedRepository();
		expect(checkReleaseVersion(root, "missing-ref").ok).toBe(false);
	});
});
