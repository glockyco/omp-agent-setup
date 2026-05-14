/**
 * Real-IO adapters for the source patches in `./patches.ts`. Kept separate
 * so the pure planner can be exercised end-to-end in tests without touching
 * the global Bun install.
 */
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { type Patch, type PatchPlanEntry, planPatch } from "./patches.ts";

/**
 * Resolve the directory the globally installed `@oh-my-pi/pi-coding-agent`
 * package lives in. Honors `$BUN_INSTALL` if set; falls back to Bun's
 * documented default of `~/.bun`.
 *
 * Mirrors how `bun add -g` itself lays out the install tree so any path we
 * compute here is the same one `omp` resolves at runtime.
 */
export function resolveOmpInstallRoot(
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
): string {
	const bunInstall = env.BUN_INSTALL ?? join(home, ".bun");
	return resolve(bunInstall, "install", "global", "node_modules", "@oh-my-pi", "pi-coding-agent");
}

/**
 * Result of executing a single patch against the filesystem. The discriminant
 * mirrors the planner's, plus an `error-write` case for cases where planning
 * succeeded but the write itself failed.
 */
export type PatchExecution =
	| { kind: "apply"; patch: Patch; targetPath: string }
	| { kind: "skip-already-applied"; patch: Patch; targetPath: string }
	| { kind: "skip-anchor-missing"; patch: Patch; targetPath: string }
	| { kind: "skip-target-missing"; patch: Patch; targetPath: string }
	| { kind: "error-anchor-ambiguous"; patch: Patch; targetPath: string; matchCount: number }
	| { kind: "error-read"; patch: Patch; targetPath: string; message: string }
	| { kind: "error-write"; patch: Patch; targetPath: string; message: string };

/**
 * Read/write hooks injected by the bootstrap. Kept narrow on purpose so tests
 * can stub them with in-memory maps.
 */
export interface PatchIO {
	read(path: string): Promise<string>;
	write(path: string, contents: string): Promise<void>;
}

const realPatchIO: PatchIO = {
	async read(path) {
		return await readFile(path, "utf8");
	},
	async write(path, contents) {
		await writeFile(path, contents);
	},
};

/**
 * Apply every patch in `patches` against `installRoot`, in order. The result
 * for each entry is one of the {@link PatchExecution} variants; later patches
 * see the file as left by earlier ones, so an `apply` is followed by
 * `skip-already-applied` on a second pass.
 *
 * Caller (the bootstrap orchestrator) is responsible for snapshotting target
 * files before invoking this so any reverted state is recoverable from the
 * timestamped backup dir.
 */
export async function applyPatches(
	patches: readonly Patch[],
	installRoot: string,
	io: PatchIO = realPatchIO,
): Promise<PatchExecution[]> {
	const results: PatchExecution[] = [];
	for (const patch of patches) {
		const targetPath = join(installRoot, patch.targetRelative);
		let current: string;
		try {
			current = await io.read(targetPath);
		} catch (error) {
			if (isEnoent(error)) {
				results.push({ kind: "skip-target-missing", patch, targetPath });
				continue;
			}
			results.push({
				kind: "error-read",
				patch,
				targetPath,
				message: errorMessage(error),
			});
			continue;
		}

		const plan = planPatch(patch, current);
		const execution = await executePlan(plan, targetPath, io);
		results.push(execution);
	}
	return results;
}

/**
 * Resolve the target paths for a set of patches without performing any I/O.
 * Used by the bootstrap to extend the snapshot list before patches mutate
 * anything on disk.
 */
export function patchTargetPaths(patches: readonly Patch[], installRoot: string): string[] {
	return patches.map(patch => join(installRoot, patch.targetRelative));
}

async function executePlan(
	plan: PatchPlanEntry,
	targetPath: string,
	io: PatchIO,
): Promise<PatchExecution> {
	switch (plan.kind) {
		case "skip-already-applied":
			return { kind: "skip-already-applied", patch: plan.patch, targetPath };
		case "skip-anchor-missing":
			return { kind: "skip-anchor-missing", patch: plan.patch, targetPath };
		case "error-anchor-ambiguous":
			return {
				kind: "error-anchor-ambiguous",
				patch: plan.patch,
				targetPath,
				matchCount: plan.matchCount,
			};
		case "apply":
			try {
				await io.write(targetPath, plan.nextContent);
				return { kind: "apply", patch: plan.patch, targetPath };
			} catch (error) {
				return {
					kind: "error-write",
					patch: plan.patch,
					targetPath,
					message: errorMessage(error),
				};
			}
	}
}

function isEnoent(error: unknown): boolean {
	return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
