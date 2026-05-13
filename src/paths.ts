import { homedir } from "node:os";
import { join, normalize } from "node:path";

/**
 * Expand a leading `~` or `~/` segment to the current user's home directory.
 *
 * - `~` becomes `homedir()`.
 * - `~/foo` becomes `<home>/foo`.
 * - Any other prefix (including `~user`) is returned unchanged; we deliberately
 *   do not resolve other users because OMP setup is single-user.
 */
export function expandHome(path: string, home: string = homedir()): string {
	if (path === "~") return home;
	if (path.startsWith("~/")) return join(home, path.slice(2));
	return path;
}

/**
 * Expand `~` and normalize separators. Returned paths are absolute when the
 * input was either absolute or `~`-prefixed; otherwise the input is preserved
 * after normalization so callers can still resolve relative to a chosen base.
 */
export function expandAndNormalize(path: string, home: string = homedir()): string {
	return normalize(expandHome(path, home));
}

/**
 * Encode an absolute filesystem path as a filename-safe single segment for use
 * inside a backup directory. The encoding is deterministic, reversible by
 * inspection, and avoids collisions between paths that differ only in
 * separators or dot placement.
 *
 * Rules:
 * - Leading slash is dropped.
 * - Path separators become `__`.
 * - Dots become `_`.
 * - Any character outside `[A-Za-z0-9_-]` becomes its lowercase hex code prefixed by `x`,
 *   so unusual filenames remain reversible at a glance.
 */
export function backupSafeName(absolutePath: string): string {
	if (!absolutePath.startsWith("/")) {
		throw new Error(`backupSafeName requires an absolute path, got: ${absolutePath}`);
	}
	const stripped = absolutePath.slice(1);
	let out = "";
	for (const ch of stripped) {
		if (ch === "/") {
			out += "__";
		} else if (ch === ".") {
			out += "_";
		} else if (/[A-Za-z0-9_-]/.test(ch)) {
			out += ch;
		} else {
			out += `x${ch.charCodeAt(0).toString(16)}`;
		}
	}
	return out;
}

/** True when `child` is `parent` itself or strictly nested under it. */
export function isPathInside(parent: string, child: string): boolean {
	const parentNorm = normalize(parent).replace(/\/+$/, "");
	const childNorm = normalize(child).replace(/\/+$/, "");
	if (parentNorm === childNorm) return true;
	return childNorm.startsWith(`${parentNorm}/`);
}
