/**
 * Real-IO adapters for the plugin orchestration in src/plugins.ts.
 *
 * Separated out so the planner and executor in plugins.ts can be unit-tested
 * with stub runners and probes under a coverage threshold, while these pure
 * subprocess and filesystem wrappers are exercised only through integration
 * runs (bun run bootstrap against the real workstation).
 *
 * This file is excluded from coverage reporting on purpose.
 */
import { type SpawnOptions, spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { type GitProbe, type GitRunner, type PluginManifest, parseManifest } from "./plugins.ts";

/**
 * Read and parse the plugin manifest from disk. Pure parsing lives in
 * `plugins.ts:parseManifest`; the filesystem read stays here so the planner
 * can be tested without touching the disk.
 */
export async function loadManifest(manifestPath: string, home: string): Promise<PluginManifest> {
	const text = await readFile(manifestPath, "utf8");
	return parseManifest(text, home);
}

export const realGitRunner: GitRunner = {
	async run(args, options) {
		return await execCapture("git", args, { cwd: options.cwd });
	},
};

export const realGitProbe: GitProbe = {
	async hasGit(path) {
		try {
			await stat(`${path}/.git`);
			return true;
		} catch {
			return false;
		}
	},
	async getRemoteUrl(path, remoteName) {
		try {
			const { stdout } = await execCapture("git", ["-C", path, "remote", "get-url", remoteName], {});
			return stdout.trim();
		} catch {
			return null;
		}
	},
	async hasLocalBranch(path, branch) {
		try {
			await execCapture("git", ["-C", path, "rev-parse", "--verify", branch], {});
			return true;
		} catch {
			return false;
		}
	},
	async hasOriginBranch(path, branch) {
		try {
			await execCapture("git", ["-C", path, "rev-parse", "--verify", `origin/${branch}`], {});
			return true;
		} catch {
			return false;
		}
	},
};

async function execCapture(
	command: string,
	args: string[],
	options: SpawnOptions & { cwd?: string },
): Promise<{ stdout: string; stderr: string }> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", chunk => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", chunk => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", code => {
			if (code === 0) resolve({ stdout, stderr });
			else reject(new Error(`${command} ${args.join(" ")} failed with exit ${code}\n${stderr}`));
		});
	});
}
