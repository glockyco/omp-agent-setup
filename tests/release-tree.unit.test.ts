import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
	chmodSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pythonExecutable } from "../scripts/check-installed-release.ts";
import { readPin } from "../scripts/omp-pin.ts";
import { CATALOG, PAYLOAD, validateReleaseTree } from "../scripts/release.ts";
import {
	canonicalScratchRoot,
	cleanupReleaseOmp,
	isolatedEnvironment,
	setupReleaseOmp,
} from "../scripts/setup-release-omp.ts";

const repository = join(import.meta.dir, "..");
const scratch: string[] = [];

afterEach(() => {
	for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** Copies the candidate release tree (catalog plus payload) into a disposable root. */
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
			/extension entry missing: \.\/extensions\/vault\.ts/,
		],
		[
			"missing extension module",
			(root: string) => rmSync(join(root, PAYLOAD, "extensions", "vault.ts")),
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
			"missing notes skill",
			(root: string) => rmSync(join(root, PAYLOAD, "skills", "notes"), { recursive: true }),
			/skill missing: notes/,
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
			"missing documentation rule",
			(root: string) => rmSync(join(root, PAYLOAD, "rules", "documentation.md")),
			/rule missing: rules\/documentation\.md/,
		],
		[
			"missing project handoff rule",
			(root: string) => rmSync(join(root, PAYLOAD, "rules", "project-handoff.md")),
			/rule missing: rules\/project-handoff\.md/,
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

describe("native release provisioning", () => {
	test("Python defaults to the host venv and explicit PYTHON_BIN remains one executable", () => {
		expect(pythonExecutable({}, "win32")).toBe(join(repository, ".venv", "Scripts", "python.exe"));
		expect(pythonExecutable({}, "linux")).toBe(join(repository, ".venv", "bin", "python"));
		expect(pythonExecutable({ PYTHON_BIN: "C:\\Python with spaces\\python.exe" }, "win32")).toBe(
			"C:\\Python with spaces\\python.exe",
		);
	});

	test("setup redirects every state root and removes inherited provider/profile selectors", async () => {
		const root = canonicalScratchRoot(mkdtempSync(join(tmpdir(), "release setup with spaces ")));
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
		const root = canonicalScratchRoot(mkdtempSync(join(tmpdir(), "not release setup ")));
		scratch.push(root);
		await expect(cleanupReleaseOmp(root)).rejects.toThrow();
		expect(existsSync(root)).toBe(true);
	});

	test("failed fixed-asset download removes scratch and never fetches metadata or latest", async () => {
		const before = readdirSync(tmpdir()).filter(name => name.startsWith("personal release omp "));
		const pin = await readPin();
		const host = process.platform === "win32" ? "windows" : process.platform;
		const name = `omp-${host}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
		const fetch = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("unavailable", { status: 503 }),
		);
		try {
			await expect(setupReleaseOmp()).rejects.toThrow(/HTTP 503/);
			expect(fetch).toHaveBeenCalledTimes(1);
			expect(fetch.mock.calls[0]?.[0]).toBe(
				`https://github.com/can1357/oh-my-pi/releases/download/${pin.tag}/${name}`,
			);
			expect(readdirSync(tmpdir()).filter(name => name.startsWith("personal release omp "))).toEqual(
				before,
			);
		} finally {
			fetch.mockRestore();
		}
	});

	test("a reviewed pin missing a platform digest fails before download", async () => {
		const pin = await readPin();
		const before = readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp "));
		const fetch = spyOn(globalThis, "fetch");
		try {
			const assets = { ...pin.assets } as Record<string, string>;
			delete assets["omp-windows-arm64.exe"];
			await expect(setupReleaseOmp({ pin: { tag: pin.tag, assets } })).rejects.toThrow(
				/missing asset/,
			);
			expect(fetch).not.toHaveBeenCalled();
			expect(readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp "))).toEqual(
				before,
			);
		} finally {
			fetch.mockRestore();
		}
	});

	test("a digest mismatch fails before the downloaded asset can execute and removes scratch", async () => {
		const before = readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp "));
		const fetch = spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response("must never execute this unverified asset"),
		);
		try {
			await expect(setupReleaseOmp()).rejects.toThrow(
				/digest: expected sha256:[a-f0-9]+, observed sha256:/,
			);
			expect(fetch).toHaveBeenCalledTimes(1);
			expect(readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp "))).toEqual(
				before,
			);
		} finally {
			fetch.mockRestore();
		}
	});
	test.each(["initial", "interrupted"])(
		"a failed asset stream (%s) removes its binary and every setup profile",
		async stage => {
			const before = readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp "));
			const body = new ReadableStream<Uint8Array>({
				start(controller) {
					if (stage === "initial") controller.error(new Error("partial asset failed"));
					else controller.enqueue(new TextEncoder().encode("partial binary"));
				},
				pull(controller) {
					controller.error(new Error("partial asset failed"));
				},
			});
			const fetch = spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(body));
			try {
				await expect(setupReleaseOmp()).rejects.toThrow("partial asset failed");
				expect(fetch).toHaveBeenCalledTimes(1);
				expect(
					readdirSync(tmpdir()).filter(entry => entry.startsWith("personal release omp ")),
				).toEqual(before);
			} finally {
				fetch.mockRestore();
			}
		},
	);
});
