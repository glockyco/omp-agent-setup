// Pure logic for `bun run update-vendored-skill <name>`: argument parsing and
// subtree selection. The network and filesystem work lives in
// `vendored-skill-update-runtime.ts`.

export type UpdateVendoredSkillArgs =
	| { kind: "run"; name: string }
	| { kind: "help" }
	| { kind: "error"; message: string };

const USAGE = "usage: bun run update-vendored-skill <name>";

/** Accepts exactly one name, or `--help`/`-h`. Zero or 2+ args is an error. */
export function parseUpdateVendoredSkillArgs(args: readonly string[]): UpdateVendoredSkillArgs {
	if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return { kind: "help" };
	const name = args[0];
	if (args.length !== 1 || name === undefined) return { kind: "error", message: USAGE };
	return { kind: "run", name };
}

export interface TreeEntry {
	path: string;
	type: string;
}

/**
 * Blob paths under `<sourceDir>/`, returned relative to `sourceDir`. The `..`
 * guard is what keeps a hostile or malformed tree listing from writing outside
 * the vendored directory when the caller joins these onto a local root.
 */
export function selectSubtreeFiles(entries: readonly TreeEntry[], sourceDir: string): string[] {
	const prefix = `${sourceDir.replace(/\/+$/, "")}/`;
	const files: string[] = [];
	for (const entry of entries) {
		if (entry.type !== "blob" || !entry.path.startsWith(prefix)) continue;
		const relative = entry.path.slice(prefix.length);
		if (relative.split("/").includes("..")) {
			throw new Error(`refusing path with '..' segment: ${entry.path}`);
		}
		files.push(relative);
	}
	return files;
}
