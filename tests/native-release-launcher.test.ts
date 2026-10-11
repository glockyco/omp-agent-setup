import type { Mock } from "bun:test";
import { afterAll, afterEach, beforeAll, beforeEach, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { checkInstalledRelease } from "../scripts/check-installed-release.ts";
import {
	checkOmpVersion,
	cleanupReleaseOmp,
	isolatedEnvironment,
	releasePin,
	setupReleaseOmp,
} from "../scripts/setup-release-omp.ts";

let root: string;
let omp: string;
let python: string;
let bytes: Buffer;
let savedEnvironment: NodeJS.ProcessEnv;
let requests: Mock<typeof globalThis.fetch> | undefined;
const repository = join(import.meta.dir, "..");

beforeAll(async () => {
	root = mkdtempSync(join(tmpdir(), "native release boundary with spaces "));
	omp = join(root, process.platform === "win32" ? "omp.exe" : "omp");
	python = join(root, process.platform === "win32" ? "python.exe" : "python");
	const compile = Bun.spawn(
		[
			process.execPath,
			"build",
			"--compile",
			join(import.meta.dir, "fixtures/release-tools.ts"),
			"--outfile",
			omp,
		],
		{ stdout: "ignore", stderr: "pipe" },
	);
	const errors = await new Response(compile.stderr).text();
	if ((await compile.exited) !== 0)
		throw new Error(`Native release boundary compilation failed: ${errors}`);
	linkSync(omp, python);
	bytes = readFileSync(omp);
}, 120000);

afterAll(() => {
	rmSync(root, { recursive: true, force: true });
});
beforeEach(() => {
	savedEnvironment = { ...process.env };
	process.env.OMP_BIN = omp;
	process.env.PYTHON_BIN = python;
	delete process.env.NATIVE_GATE_FIXTURE_LOG;
	delete process.env.NATIVE_GATE_FIXTURE_OMP_VERSION;
	delete process.env.NATIVE_GATE_FIXTURE_PYTHON_VERSION;
	delete process.env.NATIVE_GATE_FIXTURE_EXIT_CODE;
});
afterEach(() => {
	requests?.mockRestore();
	requests = undefined;
	for (const key of Object.keys(process.env))
		if (!(key in savedEnvironment)) delete process.env[key];
	Object.assign(process.env, savedEnvironment);
});

async function assetFixture() {
	const pin = await releasePin();
	const host = process.platform === "win32" ? "windows" : process.platform;
	const name = `omp-${host}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
	requests = spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(
			Response.json({
				tag_name: pin,
				assets: [
					{
						name,
						digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
						browser_download_url: `https://github.com/can1357/oh-my-pi/releases/download/${pin}/${name}`,
					},
				],
			}),
		)
		.mockResolvedValueOnce(new Response(bytes));
}

function scratchNames() {
	return readdirSync(tmpdir())
		.filter(
			name =>
				name.startsWith("personal release omp ") || name.startsWith("personal release launcher "),
		)
		.sort();
}

test("exact-version verifier executes one absolute native argv boundary and rejects wrong versions", async () => {
	const env = await isolatedEnvironment(join(root, "version profile"));
	await checkOmpVersion(omp, env);
	await expect(
		checkOmpVersion(omp, { ...env, NATIVE_GATE_FIXTURE_OMP_VERSION: "18.8.6" }),
	).rejects.toThrow("expected 18.8.7, observed omp/18.8.6");
	await expect(checkOmpVersion("relative-omp", env)).rejects.toThrow("absolute");
});

test("digest-verified selected asset becomes an executable only in owned scratch and is removable", async () => {
	await assetFixture();
	const setup = await setupReleaseOmp();
	try {
		expect(isAbsolute(setup.binary)).toBe(true);
		expect(
			setup.binary.startsWith(`${setup.root}/`) || setup.binary.startsWith(`${setup.root}\\`),
		).toBe(true);
		expect(readFileSync(setup.binary).equals(bytes)).toBe(true);
		expect(requests).toHaveBeenCalledTimes(2);
	} finally {
		await cleanupReleaseOmp(setup.root);
	}
	expect(existsSync(setup.root)).toBe(false);
});

test("launcher selects the explicit interpreter and pinned binary with isolated roots, then removes its profile", async () => {
	const log = join(root, "launcher log.jsonl");
	rmSync(log, { force: true });
	process.env.NATIVE_GATE_FIXTURE_LOG = log;
	const before = scratchNames();
	await checkInstalledRelease();
	const calls = readFileSync(log, "utf8")
		.trim()
		.split("\n")
		.map(line => JSON.parse(line));
	expect(calls.map(call => call.args)).toEqual([
		["--version"],
		["--version"],
		[join(repository, "tests/release_gate.py")],
	]);
	for (const call of calls) {
		for (const key of ["home", "profile", "appdata", "localappdata", "temp", "tmp"])
			expect(call[key]).toContain("personal release launcher ");
	}
	expect(calls[2].cwd).toBe(repository);
	expect(scratchNames()).toEqual(before);
});

test("launcher provisions the selected official asset when OMP_BIN is absent and removes setup plus profile", async () => {
	delete process.env.OMP_BIN;
	await assetFixture();
	const before = scratchNames();
	await checkInstalledRelease();
	expect(requests).toHaveBeenCalledTimes(2);
	expect(scratchNames()).toEqual(before);
});

test("Python version and subprocess failures propagate while every launcher profile is removed", async () => {
	const before = scratchNames();
	process.env.NATIVE_GATE_FIXTURE_PYTHON_VERSION = "3.12.1";
	await expect(checkInstalledRelease()).rejects.toThrow("expected 3.13, observed Python 3.12.1");
	delete process.env.NATIVE_GATE_FIXTURE_PYTHON_VERSION;
	process.env.NATIVE_GATE_FIXTURE_EXIT_CODE = "23";
	await expect(checkInstalledRelease()).rejects.toThrow(
		"installed-release gate failed with exit code 23",
	);
	expect(scratchNames()).toEqual(before);
});

test("relative configured OMP is refused before any profile or subprocess", async () => {
	process.env.OMP_BIN = "relative-omp";
	const before = scratchNames();
	await expect(checkInstalledRelease()).rejects.toThrow("absolute");
	expect(scratchNames()).toEqual(before);
});
