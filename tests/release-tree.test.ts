import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
	chmodSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pythonExecutable } from "../scripts/check-installed-release.ts";
import { checkReleaseVersion } from "../scripts/check-release-version.ts";
import { CATALOG, PAYLOAD, validateReleaseTree } from "../scripts/release.ts";
import {
	cleanupReleaseOmp,
	isolatedEnvironment,
	releasePin,
	setupReleaseOmp,
} from "../scripts/setup-release-omp.ts";

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

	test("Windows accepts a readable Python asset without Unix executable bits", () => {
		const root = candidate();
		chmodSync(join(root, PAYLOAD, "skills", "research-evidence", "scripts", "fetch_pdf.py"), 0o644);
		expect(validateReleaseTree(root, "win32")).toEqual([]);
		if (process.platform !== "win32") {
			expect(validateReleaseTree(root).join("\n")).toMatch(/not executable/);
		}
	});

	test("a directory cannot substitute for a readable Python asset", () => {
		const root = candidate();
		const helper = join(root, PAYLOAD, "skills", "research-evidence", "scripts", "fetch_pdf.py");
		rmSync(helper);
		mkdirSync(helper);
		expect(validateReleaseTree(root, "win32").join("\n")).toMatch(/not readable/);
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
			"missing personal policy",
			(root: string) => rmSync(join(root, PAYLOAD, "rules", "personal-policy.md")),
			/rule missing: rules\/personal-policy\.md/,
		],
		[
			"missing plain-prose rule",
			(root: string) => rmSync(join(root, PAYLOAD, "rules", "plain-prose.md")),
			/rule missing: rules\/plain-prose\.md/,
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

describe("native release provisioning", () => {
	test("Python defaults to the host venv and explicit PYTHON_BIN remains one executable", () => {
		expect(pythonExecutable({}, "win32")).toBe(join(repository, ".venv", "Scripts", "python.exe"));
		expect(pythonExecutable({}, "linux")).toBe(join(repository, ".venv", "bin", "python"));
		expect(pythonExecutable({ PYTHON_BIN: "C:\\Python with spaces\\python.exe" }, "win32")).toBe(
			"C:\\Python with spaces\\python.exe",
		);
	});

	test("setup redirects every state root and removes inherited provider/profile selectors", async () => {
		const root = mkdtempSync(join(tmpdir(), "release setup with spaces "));
		scratch.push(root);
		const saved = {
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			PI_AGENT_DIR: process.env.PI_AGENT_DIR,
		};
		try {
			process.env.OPENAI_API_KEY = "must not reach release OMP";
			process.env.PI_AGENT_DIR = "must not select real profile";
			const env = await isolatedEnvironment(root);
			expect(env.OPENAI_API_KEY).toBeUndefined();
			expect(env.PI_AGENT_DIR).toBeUndefined();
			for (const key of [
				"HOME",
				"USERPROFILE",
				"APPDATA",
				"LOCALAPPDATA",
				"TEMP",
				"TMP",
				"TMPDIR",
				"XDG_CONFIG_HOME",
				"XDG_DATA_HOME",
				"XDG_CACHE_HOME",
				"XDG_STATE_HOME",
			]) {
				expect(env[key]?.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`)).toBe(true);
				const path = env[key];
				if (!path) throw new Error(`Missing isolated ${key}`);
				expect(existsSync(path)).toBe(true);
			}
		} finally {
			for (const [key, value] of Object.entries(saved)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}
	});

	test("cleanup refuses an unowned directory", async () => {
		const root = mkdtempSync(join(tmpdir(), "not release setup "));
		scratch.push(root);
		await expect(cleanupReleaseOmp(root)).rejects.toThrow();
		expect(existsSync(root)).toBe(true);
	});

	test("failed release metadata removes scratch and never selects latest", async () => {
		const before = readdirSync(tmpdir()).filter(name => name.startsWith("personal release omp "));
		const pin = await releasePin();
		const fetch = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("unavailable", { status: 503 }),
		);
		try {
			await expect(setupReleaseOmp()).rejects.toThrow(/HTTP 503/);
			expect(fetch.mock.calls[0]?.[0]).toBe(
				`https://api.github.com/repos/can1357/oh-my-pi/releases/tags/${pin}`,
			);
			expect(readdirSync(tmpdir()).filter(name => name.startsWith("personal release omp "))).toEqual(
				before,
			);
		} finally {
			fetch.mockRestore();
		}
	});

	test("an official asset without a published digest is rejected before download", async () => {
		const pin = await releasePin();
		const host = process.platform === "win32" ? "windows" : process.platform;
		const name = `omp-${host}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
		const before = readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp "));
		const fetch = spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({ tag_name: pin, assets: [{ name, digest: null }] }),
		);
		try {
			await expect(setupReleaseOmp()).rejects.toThrow(/no published SHA-256/);
			expect(fetch).toHaveBeenCalledTimes(1);
			expect(readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp "))).toEqual(
				before,
			);
		} finally {
			fetch.mockRestore();
		}
	});

	test("a digest mismatch fails before the downloaded asset can execute and removes scratch", async () => {
		const pin = await releasePin();
		const host = process.platform === "win32" ? "windows" : process.platform;
		const name = `omp-${host}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
		const before = readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp "));
		const fetch = spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				Response.json({
					tag_name: pin,
					assets: [
						{
							name,
							digest: `sha256:${"0".repeat(64)}`,
							browser_download_url: `https://github.com/can1357/oh-my-pi/releases/download/${pin}/${name}`,
						},
					],
				}),
			)
			.mockResolvedValueOnce(new Response("must never execute this unverified asset"));
		try {
			await expect(setupReleaseOmp()).rejects.toThrow(/digest: expected sha256:0+, observed sha256:/);
			expect(fetch).toHaveBeenCalledTimes(2);
			expect(readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp "))).toEqual(
				before,
			);
		} finally {
			fetch.mockRestore();
		}
	});
});
