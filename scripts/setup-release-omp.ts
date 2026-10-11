import { createHash } from "node:crypto";
import {
	appendFile,
	chmod,
	mkdir,
	mkdtemp,
	open,
	readFile,
	realpath,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { type OmpAsset, readPin, validatePin } from "./omp-pin.ts";

const marker = ".personal-release-omp";
const providerPrefixes = [
	"PI_",
	"OMP_",
	"ANTHROPIC_",
	"OPENAI_",
	"GEMINI_",
	"GOOGLE_",
	"AZURE_",
	"AWS_",
	"OPENROUTER_",
	"XAI_",
	"GROQ_",
	"MISTRAL_",
	"COHERE_",
	"DEEPSEEK_",
];

/** Both setup and version probes stay outside host/Tern state. */
export async function isolatedEnvironment(
	root: string,
	source: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, string>> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(source)) {
		if (
			value !== undefined &&
			!providerPrefixes.some(prefix => key.toUpperCase().startsWith(prefix)) &&
			![
				"CLAUDE_CONFIG_DIR",
				"CODEX_HOME",
				"HOMEDRIVE",
				"HOMEPATH",
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
			].includes(key.toUpperCase())
		)
			env[key] = value;
	}
	await mkdir(root, { recursive: true });
	root = await realpath(root);
	const home = join(root, "home");
	const paths = {
		HOME: home,
		USERPROFILE: home,
		APPDATA: join(home, "AppData", "Roaming"),
		LOCALAPPDATA: join(home, "AppData", "Local"),
		TEMP: join(root, "temp"),
		TMP: join(root, "temp"),
		TMPDIR: join(root, "temp"),
		XDG_CONFIG_HOME: join(home, ".config"),
		XDG_DATA_HOME: join(home, ".local", "share"),
		XDG_CACHE_HOME: join(home, ".cache"),
		XDG_STATE_HOME: join(home, ".local", "state"),
	};
	for (const path of Object.values(paths)) await mkdir(path, { recursive: true });
	return { ...env, ...paths, PI_SKIP_VERSION_CHECK: "1" };
}

export async function checkOmpVersion(
	binary: string,
	env: Record<string, string>,
	expectedTag?: string,
): Promise<void> {
	if (!isAbsolute(binary))
		throw new Error("OMP_BIN must be an absolute pinned official binary path");
	const expected = (expectedTag ?? (await readPin()).tag).slice(1);
	const child = Bun.spawn([binary, "--version"], {
		cwd: env.HOME,
		env,
		stdout: "pipe",
		stderr: "pipe",
	});
	const timer = setTimeout(() => child.kill(), 30_000);
	try {
		const [stdout, stderr, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		const observed = `${stdout}${stderr}`.trim();
		if (
			code !== 0 ||
			!new RegExp(`(?<![\\d.])${expected.replaceAll(".", "\\.")}(?![\\d.])`).test(observed)
		)
			throw new Error(`OMP version: expected ${expected}, observed ${observed}`);
	} finally {
		clearTimeout(timer);
	}
}

export async function cleanupReleaseOmp(root: string): Promise<void> {
	if (
		!isAbsolute(root) ||
		(await readFile(join(root, marker), "utf8")) !== "personal release OMP scratch\n"
	)
		throw new Error("refusing cleanup of an unowned OMP setup root");
	await rm(root, { recursive: true, force: true });
}

/** Download only the selected official release asset; no installer or host PATH writes. */
export async function setupReleaseOmp(
	options: {
		pin?: unknown;
		env?: NodeJS.ProcessEnv;
		scratchDirectory?: string;
		request?: (url: string, init?: RequestInit) => Promise<Response>;
	} = {},
): Promise<{ root: string; binary: string }> {
	const source = { ...(options.env ?? process.env) };
	const temporary = options.scratchDirectory ?? tmpdir();
	const request = options.request ?? fetch;
	const pin = options.pin === undefined ? await readPin() : validatePin(options.pin);
	const root = await mkdtemp(join(temporary, "personal release omp "));
	try {
		await writeFile(join(root, marker), "personal release OMP scratch\n");
		const env = await isolatedEnvironment(root, source);
		if (
			!["win32", "linux", "darwin"].includes(process.platform) ||
			!["x64", "arm64"].includes(process.arch)
		)
			throw new Error(`unsupported OMP release host: ${process.platform}/${process.arch}`);
		const host = process.platform === "win32" ? "windows" : process.platform;
		const name =
			`omp-${host}-${process.arch}${process.platform === "win32" ? ".exe" : ""}` as OmpAsset;
		const expectedDigest = pin.assets[name];
		const url = `https://github.com/can1357/oh-my-pi/releases/download/${pin.tag}/${name}`;
		const download = await request(url, {
			credentials: "omit",
			signal: AbortSignal.timeout(900_000),
		});
		if (!download.ok || !download.body)
			throw new Error(`OMP asset download failed: HTTP ${download.status}`);
		const binary = join(root, process.platform === "win32" ? "omp.exe" : "omp");
		const hash = createHash("sha256");
		const file = await open(binary, "wx", 0o600);
		try {
			for await (const chunk of download.body) {
				hash.update(chunk);
				let offset = 0;
				while (offset < chunk.byteLength) {
					const { bytesWritten } = await file.write(chunk, offset, chunk.byteLength - offset);
					if (bytesWritten === 0) throw new Error("OMP asset write made no progress");
					offset += bytesWritten;
				}
			}
		} finally {
			await file.close();
		}
		const observed = `sha256:${hash.digest("hex")}`;
		if (observed !== expectedDigest)
			throw new Error(`OMP ${name} digest: expected ${expectedDigest}, observed ${observed}`);
		if (process.platform !== "win32") await chmod(binary, 0o700);
		await checkOmpVersion(binary, env, pin.tag);
		return { root, binary };
	} catch (error) {
		await rm(root, { recursive: true, force: true });
		throw error;
	}
}

if (import.meta.main) {
	try {
		if (process.argv.slice(2).join(" ") === "--cleanup") {
			await cleanupReleaseOmp(process.env.OMP_SETUP_ROOT ?? "");
		} else {
			if (process.argv.length !== 2)
				throw new Error("usage: bun scripts/setup-release-omp.ts [--cleanup]");
			const setup = await setupReleaseOmp();
			try {
				if (process.env.GITHUB_ENV)
					await appendFile(
						process.env.GITHUB_ENV,
						`OMP_BIN=${setup.binary}\nOMP_SETUP_ROOT=${setup.root}\n`,
					);
				console.log(setup.binary);
				console.error(`OMP_SETUP_ROOT=${setup.root}`);
			} catch (error) {
				await cleanupReleaseOmp(setup.root);
				throw error;
			}
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
