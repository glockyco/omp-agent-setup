/**
 * Pure planner for re-pointing the globally installed `omp` bin at the
 * package's TypeScript entry (`pi-coding-agent/src/cli.ts`) instead of the
 * minified bundle (`dist/cli.js`).
 *
 * Running from source makes the readable, identifier-stable source patches in
 * `./patches.ts` effective at runtime, so the brittle minified-bundle patches
 * (whose anchors drift on every rebuild) can be dropped entirely. Bun resolves
 * `@oh-my-pi/*` package `import` conditions to `./src/*.ts`, so the whole
 * module graph — including the separate `pi-agent-core` package — loads from
 * source and honors those patches.
 *
 * The planner is filesystem-pure: callers probe the current bin state and
 * whether the source entry is a usable bin target (an executable file), then
 * this decides the action. Keeping the decision pure lets the full decision
 * matrix be exercised without mutating the real global Bun install.
 */
import { dirname, isAbsolute, join, normalize } from "node:path";

/** Current filesystem state at the bin path, from an lstat (+ readlink). */
export type BinState =
	| { kind: "missing" }
	| { kind: "symlink"; target: string }
	| { kind: "file" }
	| { kind: "directory" };

/** Decision for the bin path. Only `create`/`repoint` mutate the filesystem. */
export type BinLinkPlan =
	| { kind: "skip-up-to-date"; target: string }
	| { kind: "create"; target: string }
	| { kind: "repoint"; target: string; previousTarget: string | null; previousWasSymlink: boolean }
	| { kind: "skip-source-unusable"; target: string }
	| { kind: "blocked"; reason: "non-symlink-directory" };

export interface BinLinkInput {
	/** Absolute path of the managed bin (e.g. `~/.bun/bin/omp`). */
	binPath: string;
	/** Absolute path of the desired symlink target (the source CLI entry). */
	desiredTarget: string;
	/** Current state at `binPath`. */
	current: BinState;
	/** Whether `desiredTarget` is a usable bin target (an executable file). */
	sourceUsable: boolean;
}

/**
 * Decide what to do for the managed bin.
 *
 * Order of checks is deliberate:
 * 1. Source-usable first: never strand `omp` on a bin that won't execute. If
 *    the source entry is absent or not an executable file (e.g. a hypothetical
 *    dist-only publish), leave the existing bin untouched and surface it loudly.
 * 2. By current state: create when absent, refuse a directory, replace a real
 *    file (the bootstrap snapshots it first), and for a symlink compare the
 *    resolved target so an already-correct link is a no-op.
 */
export function planBinLink(input: BinLinkInput): BinLinkPlan {
	const { binPath, desiredTarget, current, sourceUsable } = input;
	if (!isAbsolute(desiredTarget)) {
		throw new Error(`Bin link desired target must be absolute: ${desiredTarget}`);
	}

	if (!sourceUsable) {
		return { kind: "skip-source-unusable", target: desiredTarget };
	}

	switch (current.kind) {
		case "missing":
			return { kind: "create", target: desiredTarget };
		case "directory":
			return { kind: "blocked", reason: "non-symlink-directory" };
		case "file":
			return {
				kind: "repoint",
				target: desiredTarget,
				previousTarget: null,
				previousWasSymlink: false,
			};
		case "symlink": {
			const resolved = resolveLinkTarget(binPath, current.target);
			if (resolved === normalize(desiredTarget)) {
				return { kind: "skip-up-to-date", target: desiredTarget };
			}
			return {
				kind: "repoint",
				target: desiredTarget,
				previousTarget: current.target,
				previousWasSymlink: true,
			};
		}
	}
}

/**
 * Resolve a raw symlink target against the link's own directory. Symlink
 * targets are relative to the directory containing the link, not the process
 * cwd, so a relative bun-default target like
 * `../install/.../dist/cli.js` resolves correctly for comparison.
 */
function resolveLinkTarget(binPath: string, target: string): string {
	return isAbsolute(target) ? normalize(target) : normalize(join(dirname(binPath), target));
}
