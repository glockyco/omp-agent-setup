// Pure audit logic for LSP coverage across a fleet of repositories. The
// real-IO adapters that supply filesystem reads, $PATH resolution, and git
// activity live in `lsp-audit-runtime.ts`. The split mirrors the rest of the
// codebase: pure logic stays testable, real-world side effects stay one file
// away.

export interface ServerDef {
	/** Server name as it appears in omp's defaults.json. */
	readonly name: string;
	/** Executable name omp passes to its $PATH resolver. */
	readonly command: string;
	/** Filenames or single-segment globs (e.g. `*.csproj`) used as root markers. */
	readonly rootMarkers: readonly string[];
	/** True for tools that omp treats as linters rather than primary servers. */
	readonly isLinter: boolean;
	/** Reflects the `disabled: true` field if set in an override. */
	readonly disabled: boolean;
}

interface DirEntry {
	/** Filenames present in a directory (no recursion). */
	readonly files: readonly string[];
}

export interface FsView {
	/** Return entries for `dir`, or `null` when the directory is missing. */
	listDir(dir: string): DirEntry | null;
	/** Return true if `path` exists (file, symlink, or directory). */
	exists(path: string): boolean;
}

export interface PathResolver {
	/**
	 * Resolve a command name to an absolute path. Mirrors OMP's
	 * `lsp/config.ts:resolveCommand`: check project-local bin directories
	 * keyed on root markers first, then fall back to `$PATH`.
	 */
	which(cmd: string, cwd: string): string | null;
}

/**
 * Resolve the merged `ServerDef` set OMP would compute for `cwd`. Implementations
 * mirror `lsp/config.ts:loadConfig` — walk the priority-ordered config-file
 * candidates and deep-merge them over the built-in defaults.
 */
export type DefsForCwd = (cwd: string) => readonly ServerDef[];

/** Detect whether any root marker matches inside `dir`. */
export function hasRootMarkers(dir: string, markers: readonly string[], fs: FsView): boolean {
	const entry = fs.listDir(dir);
	const files = entry?.files;
	for (const marker of markers) {
		if (marker.includes("*")) {
			if (!files) continue;
			const re = globToRegExp(marker);
			for (const f of files) {
				if (re.test(f)) return true;
			}
			continue;
		}
		if (fs.exists(`${dir}/${marker}`)) return true;
	}
	return false;
}

/** Cheap single-segment glob (`*` and `?` only). Sufficient for omp's markers. */
function globToRegExp(pattern: string): RegExp {
	let out = "^";
	for (const ch of pattern) {
		if (ch === "*") out += "[^/]*";
		else if (ch === "?") out += "[^/]";
		else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp(`${out}$`);
}

export interface ServerStatus {
	readonly name: string;
	readonly command: string;
	readonly resolved: string | null;
	/** Why the server appears in this directory's candidate set. */
	readonly reason: "matched-and-resolved" | "matched-no-binary";
}

/**
 * Apply omp's per-directory detection algorithm. Returns servers whose root
 * markers match `dir`, partitioned by whether the binary resolved.
 *
 * `disabled: true` servers are excluded; the deep-merge that produces `defs`
 * must drop them before they reach this function.
 */
export function detectServersAt(
	dir: string,
	defs: readonly ServerDef[],
	fs: FsView,
	pathResolver: PathResolver,
): ServerStatus[] {
	const out: ServerStatus[] = [];
	for (const def of defs) {
		if (def.disabled) continue;
		if (!hasRootMarkers(dir, def.rootMarkers, fs)) continue;
		const resolved = pathResolver.which(def.command, dir);
		out.push({
			name: def.name,
			command: def.command,
			resolved,
			reason: resolved ? "matched-and-resolved" : "matched-no-binary",
		});
	}
	return out;
}

export type ActivityBucket = "active" | "warm" | "dormant";

export interface ActivityThresholds {
	/** A repo last touched within `activeDays` is `active`. */
	readonly activeDays: number;
	/** Older but within `warmDays` is `warm`. Beyond that is `dormant`. */
	readonly warmDays: number;
}

export const DEFAULT_ACTIVITY: ActivityThresholds = {
	activeDays: 90,
	warmDays: 365,
};

/** Classify by age of the last commit relative to `now`. */
export function classifyActivity(
	lastCommitAt: Date | null,
	now: Date,
	thresholds: ActivityThresholds = DEFAULT_ACTIVITY,
): ActivityBucket {
	if (!lastCommitAt) return "dormant";
	const ageMs = now.getTime() - lastCommitAt.getTime();
	const days = ageMs / (1000 * 60 * 60 * 24);
	if (days <= thresholds.activeDays) return "active";
	if (days <= thresholds.warmDays) return "warm";
	return "dormant";
}

export interface RepoInput {
	/** Display label. Typically the local directory's basename, but callers may */
	/** prefer to substitute the git origin's repo name (the audit-runtime does). */
	readonly label: string;
	/** Absolute filesystem path. */
	readonly path: string;
	/** Date of the most recent commit on the default branch, or null. */
	readonly lastCommitAt: Date | null;
	/** Absolute paths of workspace sub-packages (does not include the root). */
	readonly subPackages: readonly string[];
}

interface DirReport {
	readonly relPath: string;
	readonly activeServers: readonly ServerStatus[];
	readonly unresolvedServers: readonly ServerStatus[];
}

export interface RepoReport {
	readonly label: string;
	readonly path: string;
	readonly activity: ActivityBucket;
	readonly lastCommitAt: Date | null;
	readonly directories: readonly DirReport[];
}

/**
 * Run the audit on a fleet of repos. Pure function; tests inject `fs`,
 * `pathResolver`, and `defsFor`. `defsFor` is called once per directory so
 * project-root and project-config-dir overrides land exactly where OMP would
 * see them.
 */
export function auditFleet(
	repos: readonly RepoInput[],
	defsFor: DefsForCwd,
	fs: FsView,
	pathResolver: PathResolver,
	now: Date,
	thresholds: ActivityThresholds = DEFAULT_ACTIVITY,
): RepoReport[] {
	return repos.map(repo => {
		const dirs = [repo.path, ...repo.subPackages];
		const directories = dirs.map((dir): DirReport => {
			const defs = defsFor(dir);
			const detected = detectServersAt(dir, defs, fs, pathResolver);
			return {
				relPath: dir === repo.path ? "/" : dir.slice(repo.path.length + 1),
				activeServers: detected.filter(s => s.reason === "matched-and-resolved"),
				unresolvedServers: detected.filter(s => s.reason === "matched-no-binary"),
			};
		});
		return {
			label: repo.label,
			path: repo.path,
			activity: classifyActivity(repo.lastCommitAt, now, thresholds),
			lastCommitAt: repo.lastCommitAt,
			directories,
		};
	});
}

/**
 * Render a fleet report as a stable, line-oriented string for terminal output
 * and snapshot tests. Sections are grouped by activity bucket so the user sees
 * what they're actively working on first.
 */
export function renderReport(reports: readonly RepoReport[], now: Date): string {
	const buckets: Record<ActivityBucket, RepoReport[]> = { active: [], warm: [], dormant: [] };
	for (const r of reports) buckets[r.activity].push(r);

	const lines: string[] = [];
	lines.push(`LSP fleet audit  (now: ${now.toISOString().slice(0, 10)})`);
	lines.push("");

	for (const bucket of ["active", "warm", "dormant"] as const) {
		const group = buckets[bucket];
		if (group.length === 0) continue;
		lines.push(`${bucket.toUpperCase()} (${group.length})`);
		for (const repo of group) {
			const age = repo.lastCommitAt
				? `${Math.floor((now.getTime() - repo.lastCommitAt.getTime()) / 86400000)}d ago`
				: "no commits";
			lines.push(`  ${repo.label.padEnd(36)} ${age}`);
			for (const dir of repo.directories) {
				const active = dir.activeServers.map(s => s.name).join(", ");
				const unresolved = dir.unresolvedServers.map(s => s.name).join(", ");
				if (!active && !unresolved) continue;
				const prefix = `      ${dir.relPath}`.padEnd(40);
				if (active) lines.push(`${prefix} active:    ${active}`);
				if (unresolved) lines.push(`${prefix} unresolved: ${unresolved}`);
			}
		}
		lines.push("");
	}

	// Coverage gaps: any active repo with an unresolved server in any sub-dir.
	// 'Unresolved' means the root markers matched but the binary did not resolve,
	// which is OMP's true definition of a coverage gap.
	const gaps = new Map<string, string[]>();
	for (const repo of buckets.active) {
		for (const dir of repo.directories) {
			for (const s of dir.unresolvedServers) {
				const list = gaps.get(s.name) ?? [];
				list.push(`${repo.label}${dir.relPath === "/" ? "" : `:${dir.relPath}`}`);
				gaps.set(s.name, list);
			}
		}
	}
	if (gaps.size > 0) {
		lines.push("COVERAGE GAPS (active repos with missing binaries)");
		for (const [server, locations] of [...gaps.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
			lines.push(`  ${server.padEnd(30)} ${locations.length} location(s)`);
			for (const loc of locations.slice(0, 5)) lines.push(`      ${loc}`);
			if (locations.length > 5) lines.push(`      … and ${locations.length - 5} more`);
		}
		lines.push("");
		lines.push("Run 'bun run install-lsp' to fill the gaps.");
	} else if (buckets.active.length > 0) {
		lines.push("All active repos have full binary coverage.");
	}

	return `${lines.join("\n")}\n`;
}

// =============================================================================
// Pure parsing helpers used by lsp-audit-runtime.ts. Live here so they get
// unit-test coverage without crossing the FS boundary.
// =============================================================================

/**
 * Return the body of the named TOML table, or null if absent. Slices from the
 * line after `[name]` up to the next top-level table header, or to end-of-file
 * when no further header exists. Does NOT rely on `\Z` (which JavaScript
 * regex lacks).
 */
export function extractTomlTable(toml: string, name: string): string | null {
	const headerRe = new RegExp(`^\\[${escapeRegExp(name)}\\]\\s*$`, "m");
	const start = toml.match(headerRe);
	if (!start || start.index === undefined) return null;
	const after = toml.slice(start.index + start[0].length);
	const nextHeader = after.match(/^\[[^\n]*\]\s*$/m);
	return nextHeader && nextHeader.index !== undefined ? after.slice(0, nextHeader.index) : after;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract every quoted module identifier from the argument body of a Gradle
 * `include` call. Handles variadic Groovy (`include ':a', ':b'`) and Kotlin
 * DSL (`include(":a", ":b")`) calls.
 */
export function parseGradleIncludeArgs(args: string): string[] {
	const out: string[] = [];
	const re = /(['"])([^'"]+)\1/g;
	for (const m of args.matchAll(re)) {
		if (m[2]) out.push(m[2]);
	}
	return out;
}

/**
 * Find every `include(...)`/`include ':a', ':b'` call body in a Gradle settings
 * script. Returns the inside-of-the-call substring(s) for each call, ready to
 * pass through `parseGradleIncludeArgs`.
 *
 * Two valid Gradle syntaxes are recognised:
 *
 *   include(':app', ':lib')           // Kotlin DSL or modern Groovy. May span lines.
 *   include ':app', ':lib'            // Groovy without parens. Single line.
 *
 * Implementation note: a single line-bounded regex (e.g. `include[ (](...)`)
 * is unsafe because the paren form is commonly written as
 *
 *   include(
 *     ':app',
 *     ':lib',
 *   )
 *
 * — and stopping at the first newline truncates the args. Handle the two
 * forms with separate passes.
 */
export function parseGradleIncludeCalls(text: string): string[] {
	const bodies: string[] = [];
	// Paren form: balanced parens with no nesting (Gradle does not allow nested
	// parens inside include calls). `[\s\S]*?` is non-greedy across newlines.
	const parenRe = /\binclude\s*\(([\s\S]*?)\)/g;
	for (const m of text.matchAll(parenRe)) {
		if (m[1] !== undefined) bodies.push(m[1]);
	}
	// No-paren form: `include` followed by whitespace and a quoted arg, up to
	// end-of-line. Negative lookahead skips the paren form so we don't capture
	// the bare 'include' word that introduces it.
	const groovyRe = /\binclude\b(?!\s*\()\s+([^\n]*)/g;
	for (const m of text.matchAll(groovyRe)) {
		if (m[1] !== undefined) bodies.push(m[1]);
	}
	return bodies;
}
