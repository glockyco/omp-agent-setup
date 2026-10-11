import { afterAll, beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
	existsSync,
	linkSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { checkInstalledRelease } from "../scripts/check-installed-release.ts";
import { type OmpAsset, readPin } from "../scripts/omp-pin.ts";
import {
	checkOmpVersion,
	cleanupReleaseOmp,
	isolatedEnvironment,
	setupReleaseOmp,
} from "../scripts/setup-release-omp.ts";

let root: string;
let cached: { root: string; binary: string };
let bytes: Buffer;
let expectedVersion: string;
let assetUrl: string;
const requests: { url: string; init?: RequestInit }[] = [];
const hostEnvironment = { ...process.env };
const repository = join(import.meta.dir, "..");

function fixtureEnvironment(): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {
		...hostEnvironment,
		NATIVE_GATE_FIXTURE_OMP_VERSION: expectedVersion,
	};
	delete env.NATIVE_GATE_FIXTURE_LOG;
	delete env.NATIVE_GATE_FIXTURE_PYTHON_VERSION;
	delete env.NATIVE_GATE_FIXTURE_EXIT_CODE;
	return env;
}

beforeAll(async () => {
	const pin = await readPin();
	expectedVersion = pin.tag.slice(1);
	root = mkdtempSync(join(tmpdir(), "native release boundary with spaces "));
	const compiled = join(root, process.platform === "win32" ? "compiled.exe" : "compiled");
	const compile = Bun.spawn(
		[
			process.execPath,
			"build",
			"--compile",
			join(import.meta.dir, "fixtures/release-tools.ts"),
			"--outfile",
			compiled,
		],
		{ stdout: "ignore", stderr: "pipe" },
	);
	const errors = await new Response(compile.stderr).text();
	if ((await compile.exited) !== 0)
		throw new Error(`Native release boundary compilation failed: ${errors}`);
	bytes = readFileSync(compiled);
	const host = process.platform === "win32" ? "windows" : process.platform;
	const name =
		`omp-${host}-${process.arch}${process.platform === "win32" ? ".exe" : ""}` as OmpAsset;
	pin.assets[name] = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
	assetUrl = `https://github.com/can1357/oh-my-pi/releases/download/${pin.tag}/${name}`;
	cached = await setupReleaseOmp({
		pin,
		env: fixtureEnvironment(),
		scratchDirectory: root,
		request: async (url, init) => {
			requests.push({ url, init });
			return new Response(bytes);
		},
	});
}, 120000);

afterAll(() => {
	if (root) rmSync(root, { recursive: true, force: true });
});

function fixture() {
	const directory = mkdtempSync(join(root, "case "));
	const omp = join(directory, process.platform === "win32" ? "omp.exe" : "omp");
	const python = join(directory, process.platform === "win32" ? "python.exe" : "python");
	linkSync(cached.binary, omp);
	linkSync(cached.binary, python);
	const env: NodeJS.ProcessEnv = { ...fixtureEnvironment(), OMP_BIN: omp, PYTHON_BIN: python };
	return {
		root: directory,
		omp,
		env,
	};
}

async function withFixture(run: (value: ReturnType<typeof fixture>) => Promise<void>) {
	const value = fixture();
	try {
		await run(value);
	} finally {
		rmSync(value.root, { recursive: true, force: true });
	}
}

function provisionFixture(directory: string) {
	const owned = join(directory, "personal release omp prepared");
	mkdirSync(owned);
	const binary = join(owned, process.platform === "win32" ? "omp.exe" : "omp");
	linkSync(cached.binary, binary);
	linkSync(join(cached.root, ".personal-release-omp"), join(owned, ".personal-release-omp"));
	return { root: owned, binary };
}

function scratchNames(directory: string) {
	return readdirSync(directory)
		.filter(
			name =>
				name.startsWith("personal release omp ") || name.startsWith("personal release launcher "),
		)
		.sort();
}

test(
	"exact-version verifier executes one absolute native argv boundary and rejects wrong versions",
	() =>
		withFixture(async value => {
			const log = join(value.root, "version.log");
			const env = await isolatedEnvironment(join(value.root, "version profile"), {
				...value.env,
				NATIVE_GATE_FIXTURE_LOG: log,
			});
			await checkOmpVersion(value.omp, env);
			expect(JSON.parse(readFileSync(log, "utf8").trim()).cwd).toBe(env.HOME);
			const wrongVersion = `${expectedVersion}.1`;
			await expect(
				checkOmpVersion(value.omp, { ...env, NATIVE_GATE_FIXTURE_OMP_VERSION: wrongVersion }),
			).rejects.toThrow(`expected ${expectedVersion}, observed omp/${wrongVersion}`);
			await expect(checkOmpVersion("relative-omp", env)).rejects.toThrow("absolute");
		}),
	30000,
);

test(
	"digest-verified selected asset becomes an executable only in owned scratch and is removable",
	() =>
		withFixture(async value => {
			const setup = provisionFixture(value.root);
			expect(isAbsolute(cached.binary)).toBe(true);
			expect(
				cached.binary.startsWith(`${cached.root}/`) || cached.binary.startsWith(`${cached.root}\\`),
			).toBe(true);
			expect(readFileSync(setup.binary).equals(bytes)).toBe(true);
			expect(requests).toHaveLength(1);
			expect(requests[0]?.url).toBe(assetUrl);
			expect(requests[0]?.init?.headers).toBeUndefined();
			await cleanupReleaseOmp(setup.root);
			expect(existsSync(setup.root)).toBe(false);
		}),
	30000,
);

test(
	"launcher selects the explicit interpreter and pinned binary with isolated roots, then removes its profile",
	() =>
		withFixture(async value => {
			const log = join(value.root, "launcher log.jsonl");
			value.env.NATIVE_GATE_FIXTURE_LOG = log;
			await checkInstalledRelease({ env: value.env, scratchDirectory: value.root });
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
					expect(call[key]).toContain(join(value.root, "personal release launcher "));
			}
			expect(calls[2].cwd).toBe(repository);
			expect(scratchNames(value.root)).toEqual([]);
		}),
	30000,
);

test(
	"launcher provisions its selected asset when OMP_BIN is absent and removes setup plus profile",
	() =>
		withFixture(async value => {
			delete value.env.OMP_BIN;
			const setup = provisionFixture(value.root);
			let calls = 0;
			await checkInstalledRelease({
				env: value.env,
				scratchDirectory: value.root,
				provision: async () => {
					calls++;
					return setup;
				},
			});
			expect(calls).toBe(1);
			expect(existsSync(setup.root)).toBe(false);
			expect(scratchNames(value.root)).toEqual([]);
		}),
	30000,
);

test(
	"Python version and subprocess failures propagate while every launcher profile is removed",
	() =>
		withFixture(async value => {
			value.env.NATIVE_GATE_FIXTURE_PYTHON_VERSION = "3.12.1";
			await expect(
				checkInstalledRelease({ env: value.env, scratchDirectory: value.root }),
			).rejects.toThrow("expected 3.13, observed Python 3.12.1");
			delete value.env.NATIVE_GATE_FIXTURE_PYTHON_VERSION;
			value.env.NATIVE_GATE_FIXTURE_EXIT_CODE = "23";
			await expect(
				checkInstalledRelease({ env: value.env, scratchDirectory: value.root }),
			).rejects.toThrow("installed-release gate failed with exit code 23");
			expect(scratchNames(value.root)).toEqual([]);
		}),
	30000,
);

test(
	"relative configured OMP is refused before any profile or subprocess",
	() =>
		withFixture(async value => {
			value.env.OMP_BIN = "relative-omp";
			await expect(
				checkInstalledRelease({ env: value.env, scratchDirectory: value.root }),
			).rejects.toThrow("absolute");
			expect(scratchNames(value.root)).toEqual([]);
		}),
	30000,
);

test(
	"a delayed failed case cannot alter another case's captured identity or evidence",
	() =>
		withFixture(async old =>
			withFixture(async fresh => {
				delete old.env.OMP_BIN;
				old.env.NATIVE_GATE_FIXTURE_OMP_VERSION = `${expectedVersion}.1`;
				const setup = provisionFixture(old.root);
				let release!: (value: typeof setup) => void;
				const pending = new Promise<typeof setup>(resolve => {
					release = resolve;
				});
				const failed = checkInstalledRelease({
					env: old.env,
					scratchDirectory: old.root,
					provision: () => pending,
				}).catch(error => error);
				const log = join(fresh.root, "independent evidence.jsonl");
				fresh.env.NATIVE_GATE_FIXTURE_LOG = log;
				await checkInstalledRelease({ env: fresh.env, scratchDirectory: fresh.root });
				const evidence = readFileSync(log, "utf8");
				release(setup);
				const failure = await failed;
				expect(failure).toBeInstanceOf(Error);
				expect(failure.message).toContain(
					`expected ${expectedVersion}, observed omp/${expectedVersion}.1`,
				);
				expect(readFileSync(log, "utf8")).toBe(evidence);
				expect(evidence).toContain(fresh.root.replaceAll("\\", "\\\\"));
				expect(scratchNames(old.root)).toEqual([]);
				expect(scratchNames(fresh.root)).toEqual([]);
			}),
		),
	30000,
);
