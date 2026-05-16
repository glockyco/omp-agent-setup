import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { buildManagedZedSettings, mergeManagedZedSettings } from "./zed-settings.ts";

/**
 * Zed settings path on macOS / Linux. Zed uses `~/.config/zed/settings.json`
 * on both platforms (macOS keeps DB/extension state under
 * `~/Library/Application Support/Zed/` but settings stay under `~/.config/zed/`).
 */
export function zedSettingsPath(home: string = homedir()): string {
	return join(home, ".config", "zed", "settings.json");
}

/**
 * Resolve the absolute path to the `omp` binary. We bake the absolute path
 * into the managed `command` field so GUI-launched Zed (which on macOS may
 * not inherit the shell's PATH reliably) can still find it.
 *
 * Returns `null` if `omp` is not on `$PATH`; the caller decides how to react.
 */
export function resolveOmpBinary(): string | null {
	return Bun.which("omp");
}

export interface ApplyManagedZedSettingsOptions {
	path?: string;
	ompPath: string;
}

export interface ZedMergeResult {
	path: string;
	existed: boolean;
	changed: boolean;
}

/**
 * Read the user's Zed settings, run the managed merge, write back only when
 * the content actually changed. Idempotent; safe to call on every bootstrap.
 *
 * Excluded from coverage threshold via the repo's standard `*-runtime.ts`
 * exclusion (see `AGENTS.md`). Behavior is exercised by both the unit tests
 * in `tests/zed-settings.test.ts` and the integration test in
 * `tests/integration/bootstrap.test.ts`.
 */
export async function applyManagedZedSettings(
	options: ApplyManagedZedSettingsOptions,
): Promise<ZedMergeResult> {
	const path = options.path ?? zedSettingsPath();
	let existing = "";
	let existed = true;
	try {
		existing = await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		existed = false;
	}
	const merged = mergeManagedZedSettings(
		existing,
		buildManagedZedSettings({ ompPath: options.ompPath }),
	);
	const changed = merged !== existing;
	if (changed) {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, merged);
	}
	return { path, existed, changed };
}
