/**
 * Real-IO adapters for the bin re-point planner in `./bin-link.ts`. Kept
 * separate so the pure planner can be exercised without mutating the global
 * Bun install, mirroring the `patches.ts` / `patches-runtime.ts` split.
 */
import { lstat, mkdir, readlink, stat, symlink, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type BinLinkPlan, type BinState, planBinLink } from "./bin-link.ts";

/**
 * Resolve the managed `omp` bin path: `$BUN_INSTALL/bin/omp`, falling back to
 * `~/.bun/bin/omp` (Bun's default global install location).
 */
export function resolveBunBinPath(
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
): string {
	const bunInstall = env.BUN_INSTALL?.trim() || join(home, ".bun");
	return join(bunInstall, "bin", "omp");
}

/**
 * Resolve the `pi-coding-agent` TypeScript CLI entry from the `@oh-my-pi`
 * scope root: `<scopeRoot>/pi-coding-agent/src/cli.ts`.
 */
export function resolveOmpSourceEntry(scopeRoot: string): string {
	return join(scopeRoot, "pi-coding-agent", "src", "cli.ts");
}

/** Result of executing the bin re-point against the filesystem. */
export interface BinLinkExecution {
	binPath: string;
	target: string;
	plan: BinLinkPlan;
}

/** lstat (+ readlink) the bin path into a {@link BinState}. */
export async function probeBinState(binPath: string): Promise<BinState> {
	try {
		const stat = await lstat(binPath);
		if (stat.isSymbolicLink()) return { kind: "symlink", target: await readlink(binPath) };
		if (stat.isDirectory()) return { kind: "directory" };
		return { kind: "file" };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "missing" };
		throw error;
	}
}

/**
 * Plan and apply the bin re-point. Mutating outcomes use `unlink` + `symlink`
 * (never `writeFile`, which would clobber the symlink's *target*). Non-mutating
 * outcomes (`skip-up-to-date`, `skip-source-unusable`, `blocked`) leave the
 * filesystem untouched so a missing source entry can never strand `omp`.
 */
export async function executeBinLink(
	binPath: string,
	desiredTarget: string,
): Promise<BinLinkExecution> {
	const current = await probeBinState(binPath);
	const sourceUsable = await isUsableSourceEntry(desiredTarget);
	const plan = planBinLink({ binPath, desiredTarget, current, sourceUsable });

	if (plan.kind === "create") {
		await mkdir(dirname(binPath), { recursive: true });
		await symlink(desiredTarget, binPath);
	} else if (plan.kind === "repoint") {
		await unlink(binPath);
		await symlink(desiredTarget, binPath);
	}

	return { binPath, target: desiredTarget, plan };
}

/**
 * True when `path` is a usable bin target: a regular file (following symlinks)
 * with an execute bit set. A present-but-non-executable entry would make the
 * repointed `omp` symlink fail to exec, so it is treated as unusable and the
 * existing bin is left intact.
 */
export async function isUsableSourceEntry(path: string): Promise<boolean> {
	try {
		const info = await stat(path);
		return info.isFile() && (info.mode & 0o111) !== 0;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
}
