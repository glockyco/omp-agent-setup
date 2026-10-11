import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { appendFile, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const repository = resolve(import.meta.dir, "..");
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
export async function isolatedEnvironment(root: string): Promise<Record<string, string>> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
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

export async function releasePin(): Promise<string> {
	const pin = (await readFile(join(repository, ".omp-version"), "utf8")).trim();
	if (!/^v\d+\.\d+\.\d+$/.test(pin)) throw new Error(`invalid OMP release pin: ${pin}`);
	return pin;
}

export async function checkOmpVersion(binary: string, env: Record<string, string>): Promise<void> {
	if (!isAbsolute(binary))
		throw new Error("OMP_BIN must be an absolute pinned official binary path");
	const expected = (await releasePin()).slice(1);
	const child = Bun.spawn([binary, "--version"], { env, stdout: "pipe", stderr: "pipe" });
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
export async function setupReleaseOmp(): Promise<{ root: string; binary: string }> {
	const root = await mkdtemp(join(tmpdir(), "personal release omp "));
	try {
		await writeFile(join(root, marker), "personal release OMP scratch\n");
		const env = await isolatedEnvironment(root);
		const pin = await releasePin();
		if (
			!["win32", "linux", "darwin"].includes(process.platform) ||
			!["x64", "arm64"].includes(process.arch)
		)
			throw new Error(`unsupported OMP release host: ${process.platform}/${process.arch}`);
		const host = process.platform === "win32" ? "windows" : process.platform;
		const name = `omp-${host}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
		const headers = {
			Accept: "application/vnd.github+json",
			"User-Agent": "personal-omp-release-gate",
		};
		const metadata = await fetch(
			`https://api.github.com/repos/can1357/oh-my-pi/releases/tags/${pin}`,
			{ headers, signal: AbortSignal.timeout(60_000) },
		);
		if (!metadata.ok) throw new Error(`OMP release metadata failed: HTTP ${metadata.status}`);
		const release = (await metadata.json()) as {
			tag_name: string;
			assets: Array<{ name: string; digest: string; browser_download_url: string }>;
		};
		const assets = release.assets.filter(asset => asset.name === name);
		const asset = assets[0];
		if (release.tag_name !== pin || assets.length !== 1 || !asset)
			throw new Error(`OMP ${pin} must publish exactly one ${name}`);
		if (!/^sha256:[a-f0-9]{64}$/.test(asset.digest))
			throw new Error(`OMP asset ${name} has no published SHA-256 digest`);
		const url = `https://github.com/can1357/oh-my-pi/releases/download/${pin}/${name}`;
		if (asset.browser_download_url !== url)
			throw new Error(`unexpected OMP asset URL: ${asset.browser_download_url}`);
		const download = await fetch(url, { signal: AbortSignal.timeout(900_000) });
		if (!download.ok || !download.body)
			throw new Error(`OMP asset download failed: HTTP ${download.status}`);
		const binary = join(root, process.platform === "win32" ? "omp.exe" : "omp");
		const hash = createHash("sha256");
		await pipeline(
			Readable.fromWeb(download.body),
			new Transform({
				transform(chunk, _encoding, callback) {
					hash.update(chunk);
					callback(null, chunk);
				},
			}),
			createWriteStream(binary, { mode: 0o600 }),
		);
		const observed = `sha256:${hash.digest("hex")}`;
		if (observed !== asset.digest)
			throw new Error(`OMP ${name} digest: expected ${asset.digest}, observed ${observed}`);
		if (process.platform !== "win32") await chmod(binary, 0o700);
		await checkOmpVersion(binary, env);
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
