// Real-IO adapters for `lsp-audit.ts`. None of this is unit-tested directly;
// the pure logic is what we cover. Anything new that performs filesystem,
// process, or git work belongs here, behind a narrow surface.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import {
	type DefsForCwd,
	extractTomlTable,
	type FsView,
	type PathResolver,
	parseGradleIncludeArgs,
	parseGradleIncludeCalls,
	type RepoInput,
	type ServerDef,
} from "./lsp-audit.ts";
import { resolveOmpInstallRoot } from "./patches-runtime.ts";

export const realFs: FsView = {
	listDir(dir) {
		try {
			return { files: readdirSync(dir) };
		} catch {
			return null;
		}
	},
	exists(path) {
		try {
			statSync(path);
			return true;
		} catch {
			return false;
		}
	},
};

// =============================================================================
// Path resolution. Mirrors OMP's `lsp/config.ts:resolveCommand`: per-cwd
// local-bin lookup keyed on root markers, then `$PATH` fallback. Results are
// cached for the resolver's lifetime; one-shot CLI runs make hundreds of these
// calls against a small command set, and re-discovering them is wasteful.
// =============================================================================

/** Mirror of OMP's `LOCAL_BIN_PATHS`. Keep in sync with `lsp/config.ts`. */
const LOCAL_BIN_PATHS: ReadonlyArray<{ markers: readonly string[]; binDir: string }> = [
	{
		markers: ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
		binDir: "node_modules/.bin",
	},
	{ markers: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"], binDir: ".venv/bin" },
	{ markers: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"], binDir: "venv/bin" },
	{ markers: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"], binDir: ".env/bin" },
	{ markers: ["Gemfile", "Gemfile.lock"], binDir: "vendor/bundle/bin" },
	{ markers: ["Gemfile", "Gemfile.lock"], binDir: "bin" },
	{ markers: ["go.mod", "go.sum"], binDir: "bin" },
];

function hasAnyMarker(dir: string, markers: readonly string[]): boolean {
	for (const m of markers) {
		if (realFs.exists(`${dir}/${m}`)) return true;
	}
	return false;
}

export function makePathResolver(): PathResolver {
	const pathCache = new Map<string, string | null>();
	const localCache = new Map<string, string | null>();

	function whichOnPath(cmd: string): string | null {
		const cached = pathCache.get(cmd);
		if (cached !== undefined) return cached;
		const found = Bun.which(cmd) ?? null;
		pathCache.set(cmd, found);
		return found;
	}

	return {
		which(cmd, cwd) {
			const key = `${cwd}::${cmd}`;
			const cached = localCache.get(key);
			if (cached !== undefined) return cached ?? whichOnPath(cmd);
			for (const { markers, binDir } of LOCAL_BIN_PATHS) {
				if (!hasAnyMarker(cwd, markers)) continue;
				const candidate = `${cwd}/${binDir}/${cmd}`;
				if (realFs.exists(candidate)) {
					localCache.set(key, candidate);
					return candidate;
				}
			}
			localCache.set(key, null);
			return whichOnPath(cmd);
		},
	};
}

// =============================================================================
// Server definitions: merge omp's built-in defaults.json with our override.
// =============================================================================

interface RawServer {
	command?: string;
	args?: string[];
	rootMarkers?: string[];
	disabled?: boolean;
	isLinter?: boolean;
}

interface RawDefaults {
	[name: string]: RawServer;
}

interface RawOverride {
	servers?: Record<string, RawServer>;
}

/**
 * Resolve the path to OMP's built-in `defaults.json`. Honors `$BUN_INSTALL`
 * via `resolveOmpInstallRoot` so the audit works on machines that point Bun
 * at a non-default install prefix. Falls back to the legacy `~/.bun/install`
 * layout only if the BUN_INSTALL-derived path is missing, which keeps older
 * installs working without changing their environment.
 */
function locateOmpDefaults(): string {
	const primary = join(resolveOmpInstallRoot(), "src/lsp/defaults.json");
	const fallbacks = [
		primary,
		join(
			homedir(),
			".bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/lsp/defaults.json",
		),
	];
	for (const candidate of fallbacks) {
		try {
			statSync(candidate);
			return candidate;
		} catch {
			// try next
		}
	}
	throw new Error(
		`Could not locate omp's lsp/defaults.json. Tried:\n  ${fallbacks.join("\n  ")}\nSet BUN_INSTALL or reinstall @oh-my-pi/pi-coding-agent globally.`,
	);
}

// OMP's user-level config directory bases, highest priority first. Mirrors
// `config.ts` PRIORITY_LIST. Plugin roots are intentionally skipped — they would
// require warming OMP's discovery cache.
const USER_CONFIG_DIRS = [".omp/agent", ".claude", ".codex", ".gemini"] as const;
/** Project-level config directories. Same priority order. */
const PROJECT_CONFIG_DIRS = [".omp", ".claude", ".codex", ".gemini"] as const;
/** Filename variants OMP probes for each config slot. */
const CONFIG_FILENAMES = [
	"lsp.json",
	".lsp.json",
	"lsp.yaml",
	".lsp.yaml",
	"lsp.yml",
	".lsp.yml",
] as const;

/**
 * Reproduces `lsp/config.ts:getConfigPaths(cwd)` priority order, highest first.
 * Plugin roots are omitted (cf. above). Caller merges from lowest to highest
 * so later overrides win.
 */
function ompConfigPaths(cwd: string, home: string): string[] {
	const out: string[] = [];
	for (const f of CONFIG_FILENAMES) out.push(`${cwd}/${f}`);
	for (const d of PROJECT_CONFIG_DIRS) {
		for (const f of CONFIG_FILENAMES) out.push(`${cwd}/${d}/${f}`);
	}
	for (const d of USER_CONFIG_DIRS) {
		for (const f of CONFIG_FILENAMES) out.push(`${home}/${d}/${f}`);
	}
	for (const f of CONFIG_FILENAMES) out.push(`${home}/${f}`);
	return out;
}

/**
 * Report shape used to surface override-file problems. The audit asks OMP's
 * config files about every cwd we visit, so a single malformed override
 * would otherwise be reported many times. The caller is expected to dedupe
 * by `path` if it cares about message-level distinctness.
 */
export interface OverrideParseError {
	readonly path: string;
	readonly message: string;
}

function parseOverride(
	filePath: string,
	onError: (err: OverrideParseError) => void,
): RawOverride | null {
	const text = readFileSafe(filePath);
	if (!text) return null;
	try {
		if (filePath.endsWith(".json")) return JSON.parse(text) as RawOverride;
		return (parseYaml(text) ?? {}) as RawOverride;
	} catch (err) {
		// The file exists on disk but is not valid JSON/YAML. Treating that as
		// 'absent' would silently hide the real problem in audit output; surface
		// it through the supplied callback so the CLI can render it explicitly.
		const message = err instanceof Error ? err.message : String(err);
		onError({ path: filePath, message });
		return null;
	}
}

/**
 * Extract the server map from a parsed override. Mirrors OMP's
 * `normalizeConfig` (`lsp/config.ts`): nested `{ servers: { ... } }` form is
 * preferred, but a flat `{ [name]: ServerConfig }` form is also accepted so
 * legacy and hand-written files keep working. Keys whose values do not look
 * like server configs (e.g. `$comment`, `idleTimeoutMs`) are ignored.
 */
function serversFromOverride(raw: RawOverride): Record<string, RawServer> {
	const nested = (raw as { servers?: unknown }).servers;
	if (nested && typeof nested === "object" && !Array.isArray(nested)) {
		return nested as Record<string, RawServer>;
	}
	const flat: Record<string, RawServer> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!value || typeof value !== "object" || Array.isArray(value)) continue;
		const candidate = value as Record<string, unknown>;
		if (
			"command" in candidate ||
			"args" in candidate ||
			"rootMarkers" in candidate ||
			"disabled" in candidate ||
			"fileTypes" in candidate ||
			"isLinter" in candidate
		) {
			flat[key] = candidate as RawServer;
		}
	}
	return flat;
}

function toServerDefs(merged: Record<string, RawServer>): ServerDef[] {
	return Object.entries(merged)
		.map(([name, cfg]): ServerDef | null => {
			if (!cfg.command) return null;
			return {
				name,
				command: cfg.command,
				rootMarkers: cfg.rootMarkers ?? [],
				isLinter: cfg.isLinter === true,
				disabled: cfg.disabled === true,
			};
		})
		.filter((s): s is ServerDef => s !== null);
}

/**
 * Build a per-cwd `DefsForCwd` callable. Reads OMP's built-in `defaults.json`
 * once and merges every applicable override at call time, so a project-root
 * `lsp.json` or `.omp/lsp.json` in a single repo only affects that repo's
 * directories — exactly what OMP does at runtime.
 */
export function makeDefsResolver(
	home: string = homedir(),
	onParseError: (err: OverrideParseError) => void = () => {},
): DefsForCwd {
	const defaults = JSON.parse(readFileSync(locateOmpDefaults(), "utf8")) as RawDefaults;
	// Each candidate override file is parsed at most once even though the same
	// user-level paths are visited per cwd. Doubles as the dedupe for
	// `onParseError` since failed reads also cache as `null`.
	const overrideCache = new Map<string, RawOverride | null>();
	const reportedErrors = new Set<string>();
	const reportOnce = (err: OverrideParseError) => {
		if (reportedErrors.has(err.path)) return;
		reportedErrors.add(err.path);
		onParseError(err);
	};
	return (cwd: string) => {
		const merged: Record<string, RawServer> = { ...defaults };
		// Lowest priority first so later iterations win on conflicting keys.
		const paths = ompConfigPaths(cwd, home).slice().reverse();
		for (const p of paths) {
			let override = overrideCache.get(p);
			if (override === undefined) {
				override = parseOverride(p, reportOnce);
				overrideCache.set(p, override);
			}
			if (!override) continue;
			for (const [name, patch] of Object.entries(serversFromOverride(override))) {
				merged[name] = { ...(merged[name] ?? {}), ...patch };
			}
		}
		return toServerDefs(merged);
	};
}

// =============================================================================
// Repo discovery: walk ~/Projects, last-commit date, workspace sub-packages.
// =============================================================================

export interface RepoDiscoveryOptions {
	readonly projectsDir: string;
	readonly excludeNames?: readonly string[];
}

const DEFAULT_EXCLUDES = new Set(["node_modules", "backups", ".cache", ".tmp", "playground"]);

export function discoverRepos(opts: RepoDiscoveryOptions): RepoInput[] {
	const excludes = new Set([...DEFAULT_EXCLUDES, ...(opts.excludeNames ?? [])]);
	const root = resolve(opts.projectsDir);
	const entries = realFs.listDir(root);
	if (!entries) return [];

	const repos: RepoInput[] = [];
	for (const name of entries.files) {
		if (excludes.has(name)) continue;
		const dir = join(root, name);
		try {
			if (!statSync(dir).isDirectory()) continue;
		} catch {
			continue;
		}
		const label = resolveLabel(dir, name);
		const lastCommitAt = readLastCommitDate(dir);
		const subPackages = enumerateSubPackages(dir);
		repos.push({ label, path: dir, lastCommitAt, subPackages });
	}
	return repos.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Resolve a stable label for the repo. Preference order:
 *   1. `origin` remote URL → repo basename.
 *   2. `upstream` remote URL → repo basename (clones tracking a fork upstream).
 *   3. Any other configured remote → repo basename.
 *   4. The on-disk directory name (`fallback`).
 *
 * Keeps cross-references with `gh` data sane even when a clone renames its
 * primary remote or never set one.
 */
function resolveLabel(dir: string, fallback: string): string {
	const text = readFileSafe(join(dir, ".git/config"));
	if (!text) return fallback;
	const remotes = new Map<string, string>();
	const re = /\[remote "([^"]+)"\][^[]*?url\s*=\s*(\S+)/g;
	for (const m of text.matchAll(re)) {
		const [, name, url] = m;
		if (name && url) remotes.set(name, url);
	}
	const priority = ["origin", "upstream", ...remotes.keys()];
	for (const name of priority) {
		const url = remotes.get(name);
		if (!url) continue;
		const basename = repoBasename(url);
		if (basename) return basename;
	}
	return fallback;
}

function repoBasename(url: string): string | null {
	const trimmed = url.replace(/\.git$/, "");
	const slash = trimmed.lastIndexOf("/");
	const colon = trimmed.lastIndexOf(":");
	const sep = Math.max(slash, colon);
	if (sep < 0) return null;
	const tail = trimmed.slice(sep + 1);
	return tail || null;
}

function readLastCommitDate(repoDir: string): Date | null {
	if (!realFs.exists(join(repoDir, ".git"))) return null;
	try {
		const result = Bun.spawnSync({
			cmd: ["git", "-C", repoDir, "log", "-1", "--format=%cI"],
			stdout: "pipe",
			stderr: "ignore",
		});
		if (result.exitCode !== 0) return null;
		const iso = result.stdout.toString().trim();
		if (!iso) return null;
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? null : d;
	} catch {
		return null;
	}
}

function readFileSafe(path: string): string | null {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return null;
	}
}

// -----------------------------------------------------------------------------
// Workspace enumeration. Each block is a best-effort parser for one workspace
// flavor. Failure to parse is non-fatal: missing sub-packages just means the
// audit will only cover the root directory.
// -----------------------------------------------------------------------------

function enumerateSubPackages(repoDir: string): string[] {
	const out = new Set<string>();
	addPnpmWorkspaces(repoDir, out);
	addPackageJsonWorkspaces(repoDir, out);
	addCargoWorkspace(repoDir, out);
	addMavenModules(repoDir, out);
	addGradleSettings(repoDir, out);
	addSlnProjects(repoDir, out);
	return [...out].filter(p => p !== repoDir).sort();
}

function addPnpmWorkspaces(repoDir: string, out: Set<string>): void {
	const text = readFileSafe(join(repoDir, "pnpm-workspace.yaml"));
	if (!text) return;
	let doc: unknown;
	try {
		doc = parseYaml(text);
	} catch {
		return;
	}
	const packages = (doc as { packages?: unknown })?.packages;
	if (!Array.isArray(packages)) return;
	for (const pattern of packages) {
		if (typeof pattern !== "string") continue;
		for (const match of new Bun.Glob(pattern).scanSync({ cwd: repoDir, onlyFiles: false })) {
			const abs = join(repoDir, match);
			if (realFs.exists(join(abs, "package.json"))) out.add(abs);
		}
	}
}

function addPackageJsonWorkspaces(repoDir: string, out: Set<string>): void {
	const text = readFileSafe(join(repoDir, "package.json"));
	if (!text) return;
	let pkg: { workspaces?: unknown };
	try {
		pkg = JSON.parse(text) as { workspaces?: unknown };
	} catch {
		return;
	}
	const ws = pkg.workspaces;
	const patterns = Array.isArray(ws)
		? ws
		: ws && typeof ws === "object" && Array.isArray((ws as { packages?: unknown }).packages)
			? (ws as { packages: unknown[] }).packages
			: [];
	for (const pattern of patterns) {
		if (typeof pattern !== "string") continue;
		for (const match of new Bun.Glob(pattern).scanSync({ cwd: repoDir, onlyFiles: false })) {
			const abs = join(repoDir, match);
			if (realFs.exists(join(abs, "package.json"))) out.add(abs);
		}
	}
}

function addCargoWorkspace(repoDir: string, out: Set<string>): void {
	const text = readFileSafe(join(repoDir, "Cargo.toml"));
	if (!text) return;
	const wsBody = extractTomlTable(text, "workspace");
	if (wsBody === null) return;
	const parseList = (raw: string): string[] =>
		raw
			.split(",")
			.map(s => s.trim().replace(/^["']|["']$/g, ""))
			.filter(Boolean);
	const memberMatch = wsBody.match(/members\s*=\s*\[([^\]]*)\]/);
	if (!memberMatch?.[1]) return;
	const excludeMatch = wsBody.match(/exclude\s*=\s*\[([^\]]*)\]/);
	const excluded = new Set(
		(excludeMatch?.[1] ? parseList(excludeMatch[1]) : []).map(p => join(repoDir, p)),
	);
	for (const pattern of parseList(memberMatch[1])) {
		for (const match of new Bun.Glob(pattern).scanSync({ cwd: repoDir, onlyFiles: false })) {
			const abs = join(repoDir, match);
			if (excluded.has(abs)) continue;
			if (realFs.exists(join(abs, "Cargo.toml"))) out.add(abs);
		}
	}
}

function addMavenModules(repoDir: string, out: Set<string>): void {
	const text = readFileSafe(join(repoDir, "pom.xml"));
	if (!text) return;
	const re = /<module>([^<]+)<\/module>/g;
	for (const m of text.matchAll(re)) {
		const rel = m[1]?.trim();
		if (!rel) continue;
		const abs = join(repoDir, rel);
		if (realFs.exists(join(abs, "pom.xml"))) out.add(abs);
	}
}

function addGradleSettings(repoDir: string, out: Set<string>): void {
	for (const name of ["settings.gradle", "settings.gradle.kts"]) {
		const text = readFileSafe(join(repoDir, name));
		if (!text) continue;
		// First, harvest `project(':key').projectDir = new File('path')` remaps —
		// projects like jpf-symbc relocate every included module to a sibling tree.
		const remaps = new Map<string, string>();
		const remapRe =
			/project\s*\(\s*['"](:[^'"]+)['"]\s*\)\s*\.\s*projectDir\s*=\s*(?:new\s+)?(?:File|file)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
		for (const m of text.matchAll(remapRe)) {
			const [, key, customPath] = m;
			if (key && customPath) remaps.set(key, customPath);
		}
		// `include` accepts variadic arguments in both Groovy (`include ':a', ':b'`)
		// and Kotlin DSL (`include(":a", ":b")`), with the paren form commonly
		// spread across multiple lines. `parseGradleIncludeCalls` walks both
		// shapes and returns each call's arg body for `parseGradleIncludeArgs`.
		for (const body of parseGradleIncludeCalls(text)) {
			for (const seg of parseGradleIncludeArgs(body)) {
				const key = seg.startsWith(":") ? seg : `:${seg}`;
				const rel = remaps.get(key) ?? seg.replace(/^:/, "").replace(/:/g, "/");
				const abs = join(repoDir, rel);
				if (realFs.exists(abs)) out.add(abs);
			}
		}
	}
}

function addSlnProjects(repoDir: string, out: Set<string>): void {
	const entries = realFs.listDir(repoDir);
	if (!entries) return;
	for (const file of entries.files) {
		if (file.endsWith(".sln")) {
			const text = readFileSafe(join(repoDir, file));
			if (!text) continue;
			const re = /Project\([^)]*\)\s*=\s*"[^"]*",\s*"([^"]+\.csproj)"/g;
			for (const m of text.matchAll(re)) {
				const rel = m[1]?.replace(/\\/g, "/");
				if (!rel) continue;
				const abs = join(repoDir, dirnameOf(rel));
				if (realFs.exists(abs)) out.add(abs);
			}
		} else if (file.endsWith(".slnx")) {
			const text = readFileSafe(join(repoDir, file));
			if (!text) continue;
			const re = /<Project[^>]*Path="([^"]+)"/g;
			for (const m of text.matchAll(re)) {
				const rel = m[1]?.replace(/\\/g, "/");
				if (!rel) continue;
				const abs = join(repoDir, dirnameOf(rel));
				if (realFs.exists(abs)) out.add(abs);
			}
		}
	}
}

function dirnameOf(p: string): string {
	const idx = p.lastIndexOf("/");
	return idx < 0 ? "." : p.slice(0, idx);
}
