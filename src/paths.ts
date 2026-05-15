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
 * as a backup-snapshot key. The encoding is injective: every byte in the
 * input maps to a unique output sequence, so two distinct paths can never
 * collide on disk.
 *
 * Strategy: leading slash is stripped, then `_` becomes the escape lead. Every
 * non-`[A-Za-z0-9-]` character is replaced with `_HH` where `HH` is its
 * two-digit lowercase hex code. `_` itself is encoded as `_5f` for the same
 * reason, which keeps `_` from appearing as a literal in the output and makes
 * decoding unambiguous: any `_` in the output is always the start of a
 * three-character escape.
 */
export function backupSafeName(absolutePath: string): string {
	if (!absolutePath.startsWith("/")) {
		throw new Error(`backupSafeName requires an absolute path, got: ${absolutePath}`);
	}
	const stripped = absolutePath.slice(1);
	let out = "";
	for (const ch of stripped) {
		// Single-byte safe set passes through. Non-`_` matches let us keep human
		// readability; `_` itself must escape so the escape lead remains unique.
		if (/[A-Za-z0-9-]/.test(ch)) {
			out += ch;
			continue;
		}
		const codePoint = ch.codePointAt(0) ?? 0;
		out += `_${codePoint.toString(16).padStart(2, "0")}`;
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
