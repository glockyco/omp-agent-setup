import { type SpawnOptions, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

export interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
}

export interface Runner {
	run(
		command: string,
		args: readonly string[],
		options?: { timeoutMs?: number; env?: Record<string, string> },
	): Promise<CommandResult>;
}

export const realRunner: Runner = {
	async run(command, args, options = {}) {
		return await execCapture(command, args, options);
	},
};

/**
 * Assert that `text` contains every required substring. Returns the first
 * missing substring, or null when all are present. Pure helper used to keep
 * subprocess plumbing separate from assertion logic.
 */
export function findMissingSubstring(text: string, required: readonly string[]): string | null {
	for (const needle of required) {
		if (!text.includes(needle)) return needle;
	}
	return null;
}

/**
 * Detect OMP extension load failures in arbitrary command output. Returns the
 * matching line, or null.
 */
export function findExtensionError(text: string): string | null {
	const patterns = [/Extension error/i, /Failed to load extension/i];
	for (const line of text.split(/\r?\n/)) {
		for (const pattern of patterns) {
			if (pattern.test(line)) return line;
		}
	}
	return null;
}

export interface LogScanFinding {
	timestamp: string;
	level: string;
	message: string;
	source: string;
}

/**
 * Scan a JSON-lines OMP log and return entries newer than `sinceIso` that
 * match any of `patterns`. Returning structured findings (rather than just
 * booleans) is useful for diagnostics.
 */
export function scanLog(
	logText: string,
	sinceIso: string,
	patterns: readonly RegExp[],
): LogScanFinding[] {
	const since = new Date(sinceIso).getTime();
	const findings: LogScanFinding[] = [];
	for (const line of logText.split(/\r?\n/)) {
		if (!line) continue;
		let entry: Record<string, unknown>;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}
		const ts = typeof entry.timestamp === "string" ? entry.timestamp : null;
		if (!ts) continue;
		if (new Date(ts).getTime() < since) continue;
		const message = typeof entry.message === "string" ? entry.message : "";
		const errorText =
			typeof entry.error === "string"
				? entry.error
				: typeof (entry as { err?: unknown }).err === "object"
					? JSON.stringify((entry as { err?: unknown }).err)
					: "";
		const haystack = `${message}\n${errorText}\n${typeof entry.path === "string" ? entry.path : ""}`;
		const matched = patterns.find(pattern => pattern.test(haystack));
		if (!matched) continue;
		findings.push({
			timestamp: ts,
			level: typeof entry.level === "string" ? entry.level : "info",
			message,
			source: matched.source,
		});
	}
	return findings;
}

export interface OmpSmokeOptions {
	model: string;
	expected: string;
	timeoutMs?: number;
}

/** Runs `omp -p --no-session --model <model> "Reply with exactly: ..."` and asserts. */
export async function ompExtensionSmoke(
	runner: Runner,
	options: OmpSmokeOptions,
): Promise<CommandResult & { failure?: string }> {
	const result = await runner.run(
		"omp",
		["-p", "--no-session", "--model", options.model, `Reply with exactly: ${options.expected}`],
		{ timeoutMs: options.timeoutMs ?? 120_000 },
	);
	const missing = findMissingSubstring(result.stdout, [options.expected]);
	const errorLine = findExtensionError(result.stdout);
	const failure = missing
		? `expected output to contain "${missing}"`
		: errorLine
			? `extension error in output: ${errorLine}`
			: undefined;
	return { ...result, failure };
}

/** Runs the direct OMP smoke (no skills, no extensions). */
export async function ompDirectSmoke(
	runner: Runner,
	options: { expected: string; timeoutMs?: number },
): Promise<CommandResult & { failure?: string }> {
	const result = await runner.run(
		"omp",
		[
			"--no-skills",
			"--no-extensions",
			"-p",
			"--no-session",
			`Reply with exactly: ${options.expected}`,
		],
		{ timeoutMs: options.timeoutMs ?? 60_000 },
	);
	const missing = findMissingSubstring(result.stdout, [options.expected]);
	return { ...result, failure: missing ? `expected output to contain "${missing}"` : undefined };
}

export interface SkillLoaderCheckOptions {
	customDirectories: readonly string[];
	cwd?: string;
	requiredSkillNames: readonly string[];
	ompCodingAgentSrc?: string;
}

export interface SkillLoaderResult {
	loadedNames: string[];
	missing: string[];
}

/**
 * Drives OMP's own skill loader to verify that custom directories surface the
 * expected skills. We import the loader directly from the installed
 * `@oh-my-pi/pi-coding-agent` source tree so we exercise the exact code path
 * the running OMP session uses.
 */
export async function checkSkillLoader(
	options: SkillLoaderCheckOptions,
): Promise<SkillLoaderResult> {
	const home = process.env.HOME;
	if (!home) throw new Error("HOME is required for skill loader check");
	const modulePath =
		options.ompCodingAgentSrc ??
		`${home}/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/extensibility/skills.ts`;
	const mod = (await import(modulePath)) as {
		loadSkills: (opts: {
			cwd?: string;
			customDirectories?: readonly string[];
		}) => Promise<{ skills: Array<{ name: string }> }>;
	};
	const result = await mod.loadSkills({
		cwd: options.cwd ?? process.cwd(),
		customDirectories: options.customDirectories,
	});
	const loadedNames = result.skills.map(skill => skill.name).sort();
	const missing = options.requiredSkillNames.filter(name => !loadedNames.includes(name));
	return { loadedNames, missing };
}

export interface AcceptanceSmokeOptions {
	model: string;
	prompt: string;
	mentionPatterns: readonly RegExp[];
	timeoutMs?: number;
}

export async function ompAcceptanceSmoke(
	runner: Runner,
	options: AcceptanceSmokeOptions,
): Promise<CommandResult & { failure?: string }> {
	const result = await runner.run(
		"omp",
		["-p", "--no-session", "--model", options.model, options.prompt],
		{ timeoutMs: options.timeoutMs ?? 180_000 },
	);
	const matched = options.mentionPatterns.find(p => p.test(result.stdout));
	return {
		...result,
		failure: matched
			? undefined
			: `expected output to match one of: ${options.mentionPatterns
					.map(p => p.toString())
					.join(", ")}`,
	};
}

export async function readLogFile(path: string): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
		throw error;
	}
}

async function execCapture(
	command: string,
	args: readonly string[],
	options: { timeoutMs?: number; env?: Record<string, string> } & SpawnOptions,
): Promise<CommandResult> {
	return await new Promise(resolve => {
		const child = spawn(command, args as string[], {
			stdio: ["ignore", "pipe", "pipe"],
			env: options.env ? { ...process.env, ...options.env } : process.env,
		});
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		const timer = options.timeoutMs
			? setTimeout(() => {
					timedOut = true;
					child.kill("SIGTERM");
				}, options.timeoutMs)
			: null;
		child.stdout?.on("data", chunk => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", chunk => {
			stderr += chunk.toString();
		});
		child.on("close", code => {
			if (timer) clearTimeout(timer);
			resolve({ stdout, stderr, exitCode: code ?? -1, timedOut });
		});
		child.on("error", () => {
			if (timer) clearTimeout(timer);
			resolve({ stdout, stderr, exitCode: -1, timedOut });
		});
	});
}
