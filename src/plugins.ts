import { type SpawnOptions, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { expandHome } from "./paths.ts";

export interface PluginSpec {
	name: string;
	path: string;
	pathExpanded: string;
	upstream: string;
	fork: string;
	branch: string;
	currentCommit?: string;
	purpose?: string;
}

export interface PluginManifest {
	plugins: PluginSpec[];
}

/**
 * Parse a `manifests/plugins.yml` content string. The schema is intentionally
 * narrow: each plugin entry must declare a path, upstream, fork, and branch.
 * `currentCommit` and `purpose` are optional.
 */
export function parseManifest(yamlText: string, home: string): PluginManifest {
	const raw = parseYaml(yamlText) as
		| { plugins?: Record<string, Record<string, string>> }
		| null
		| undefined;
	if (!raw || typeof raw !== "object" || raw === null || !raw.plugins) {
		throw new Error("Plugin manifest must contain a top-level `plugins` map");
	}
	const plugins: PluginSpec[] = [];
	for (const [name, entry] of Object.entries(raw.plugins)) {
		const required = ["path", "upstream", "fork", "branch"] as const;
		for (const key of required) {
			if (typeof entry[key] !== "string" || entry[key].length === 0) {
				throw new Error(`Plugin ${name} is missing required field ${key}`);
			}
		}
		plugins.push({
			name,
			path: entry.path as string,
			pathExpanded: expandHome(entry.path as string, home),
			upstream: entry.upstream as string,
			fork: entry.fork as string,
			branch: entry.branch as string,
			currentCommit: entry.currentCommit,
			purpose: entry.purpose,
		});
	}
	return { plugins };
}

/** Loads and parses the manifest file at `manifestPath`. */
export async function loadManifest(manifestPath: string, home: string): Promise<PluginManifest> {
	const text = await readFile(manifestPath, "utf8");
	return parseManifest(text, home);
}

export type CheckoutStep =
	| { kind: "clone"; plugin: PluginSpec }
	| { kind: "set-origin"; plugin: PluginSpec; fork: string }
	| { kind: "set-upstream"; plugin: PluginSpec; upstream: string }
	| { kind: "checkout-branch"; plugin: PluginSpec; branch: string; source: "local" | "origin" }
	| { kind: "branch-missing"; plugin: PluginSpec; branch: string };

export interface GitProbe {
	/** True iff `<path>/.git` exists. */
	hasGit(path: string): Promise<boolean>;
	/** Returns the current URL for `remoteName`, or null if missing. */
	getRemoteUrl(path: string, remoteName: string): Promise<string | null>;
	/** True iff `branch` resolves locally. */
	hasLocalBranch(path: string, branch: string): Promise<boolean>;
	/** True iff `origin/<branch>` resolves. */
	hasOriginBranch(path: string, branch: string): Promise<boolean>;
}

/**
 * Plan the Git operations needed to bring the given plugin checkout into the
 * desired state. Pure with respect to the filesystem aside from probing.
 *
 * The ordering of returned steps matches execution order: clone (if needed)
 * happens first, then remote URLs are corrected, then branch resolution.
 */
export async function planPluginCheckout(
	plugin: PluginSpec,
	probe: GitProbe,
): Promise<CheckoutStep[]> {
	const steps: CheckoutStep[] = [];
	const repoExists = await probe.hasGit(plugin.pathExpanded);
	if (!repoExists) {
		steps.push({ kind: "clone", plugin });
		// After cloning, origin will already be the fork; upstream will need to
		// be added separately.
		steps.push({ kind: "set-upstream", plugin, upstream: plugin.upstream });
		steps.push({ kind: "checkout-branch", plugin, branch: plugin.branch, source: "origin" });
		return steps;
	}

	const currentOrigin = await probe.getRemoteUrl(plugin.pathExpanded, "origin");
	if (currentOrigin !== plugin.fork) {
		steps.push({ kind: "set-origin", plugin, fork: plugin.fork });
	}
	const currentUpstream = await probe.getRemoteUrl(plugin.pathExpanded, "upstream");
	if (currentUpstream !== plugin.upstream) {
		steps.push({ kind: "set-upstream", plugin, upstream: plugin.upstream });
	}
	if (await probe.hasLocalBranch(plugin.pathExpanded, plugin.branch)) {
		steps.push({ kind: "checkout-branch", plugin, branch: plugin.branch, source: "local" });
	} else if (await probe.hasOriginBranch(plugin.pathExpanded, plugin.branch)) {
		steps.push({ kind: "checkout-branch", plugin, branch: plugin.branch, source: "origin" });
	} else {
		steps.push({ kind: "branch-missing", plugin, branch: plugin.branch });
	}
	return steps;
}

export interface GitRunner {
	run(args: string[], options: { cwd?: string }): Promise<{ stdout: string; stderr: string }>;
}

/** Production GitRunner that shells out to the real git CLI. */
export const realGitRunner: GitRunner = {
	async run(args, options) {
		return await execCapture("git", args, { cwd: options.cwd });
	},
};

export const realGitProbe: GitProbe = {
	async hasGit(path) {
		const { stat } = await import("node:fs/promises");
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

export async function executeCheckoutSteps(
	steps: readonly CheckoutStep[],
	runner: GitRunner = realGitRunner,
): Promise<void> {
	for (const step of steps) {
		const { plugin } = step;
		if (step.kind === "clone") {
			const { mkdir } = await import("node:fs/promises");
			const { dirname } = await import("node:path");
			await mkdir(dirname(plugin.pathExpanded), { recursive: true });
			await runner.run(["clone", plugin.fork, plugin.pathExpanded], {});
		} else if (step.kind === "set-origin") {
			await runner.run(["-C", plugin.pathExpanded, "remote", "set-url", "origin", step.fork], {});
		} else if (step.kind === "set-upstream") {
			const existing = await realGitProbe.getRemoteUrl(plugin.pathExpanded, "upstream");
			if (existing === null) {
				await runner.run(["-C", plugin.pathExpanded, "remote", "add", "upstream", step.upstream], {});
			} else {
				await runner.run(
					["-C", plugin.pathExpanded, "remote", "set-url", "upstream", step.upstream],
					{},
				);
			}
		} else if (step.kind === "checkout-branch") {
			if (step.source === "local") {
				await runner.run(["-C", plugin.pathExpanded, "checkout", step.branch], {});
			} else {
				await runner.run(
					["-C", plugin.pathExpanded, "checkout", "-B", step.branch, `origin/${step.branch}`],
					{},
				);
			}
		} else if (step.kind === "branch-missing") {
			// Non-fatal; surfaced to the caller for reporting.
		}
	}
}

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
