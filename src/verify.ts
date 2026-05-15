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

/**
 * Minimal contract for OMP's `loadSkills`. Defined here so the pure check
 * doesn't depend on the installed `@oh-my-pi/pi-coding-agent` source layout.
 */
export type SkillLoader = (opts: {
	cwd?: string;
	customDirectories?: readonly string[];
}) => Promise<{ skills: ReadonlyArray<{ name: string }> }>;

export interface SkillLoaderCheckOptions {
	customDirectories: readonly string[];
	cwd: string;
	requiredSkillNames: readonly string[];
	loader: SkillLoader;
}

export interface SkillLoaderResult {
	loadedNames: string[];
	missing: string[];
}

/**
 * Drive a skill loader and compare its output to the required names. Pure
 * given an injected `loader`; the real loader lives in `verify-runtime.ts`
 * so machine-layout assumptions (HOME, the installed OMP source path) stay
 * out of the verifier itself.
 */
export async function checkSkillLoader(
	options: SkillLoaderCheckOptions,
): Promise<SkillLoaderResult> {
	const result = await options.loader({
		cwd: options.cwd,
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
