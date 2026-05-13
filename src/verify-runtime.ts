/**
 * Real-IO adapters for the verification primitives in src/verify.ts.
 *
 * Separated out so the pure parsers and orchestration in verify.ts can be
 * unit-tested with stub runners and coverage thresholds, while the
 * subprocess and filesystem wrappers here are exercised only through
 * integration runs (bun run verify against the real workstation).
 *
 * This file is excluded from coverage reporting on purpose.
 */
import { type SpawnOptions, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { CommandResult, Runner } from "./verify.ts";

export const realRunner: Runner = {
	async run(command, args, options = {}) {
		return await execCapture(command, args, options);
	},
};

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
