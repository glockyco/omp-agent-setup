import { describe, expect, test } from "bun:test";
import {
	auditFleet,
	classifyActivity,
	DEFAULT_ACTIVITY,
	detectServersAt,
	extractTomlTable,
	type FsView,
	hasRootMarkers,
	type PathResolver,
	parseGradleIncludeArgs,
	parseGradleIncludeCalls,
	renderReport,
	type ServerDef,
} from "../src/lsp-audit.ts";

/** Test fixture: an in-memory FsView built from a flat map of dir → filenames. */
function fixtureFs(layout: Record<string, readonly string[]>): FsView {
	const dirs = new Map<string, Set<string>>();
	for (const [dir, files] of Object.entries(layout)) dirs.set(dir, new Set(files));
	return {
		listDir(dir) {
			const d = dirs.get(dir);
			return d ? { files: [...d] } : null;
		},
		exists(path) {
			const slash = path.lastIndexOf("/");
			const dir = slash < 0 ? "" : path.slice(0, slash);
			const file = slash < 0 ? path : path.slice(slash + 1);
			return dirs.get(dir)?.has(file) ?? false;
		},
	};
}

/**
 * Build a PathResolver that resolves the listed commands on `$PATH`. The
 * second overload accepts a per-cwd table of project-local bins keyed on
 * `<cwd>::<cmd>` for tests that exercise OMP's local-bin precedence.
 */
function fixturePath(
	installed: readonly string[],
	localBins: Record<string, string> = {},
): PathResolver {
	const set = new Set(installed);
	return {
		which(cmd, cwd) {
			const local = localBins[`${cwd}::${cmd}`];
			if (local) return local;
			return set.has(cmd) ? `/fixture/bin/${cmd}` : null;
		},
	};
}

const TS_SERVER: ServerDef = {
	name: "typescript-language-server",
	command: "typescript-language-server",
	rootMarkers: ["package.json", "tsconfig.json"],
	isLinter: false,
	disabled: false,
};

const SVELTE_TIGHT: ServerDef = {
	name: "svelte",
	command: "svelteserver",
	rootMarkers: ["svelte.config.js", "svelte.config.mjs"],
	isLinter: false,
	disabled: false,
};

const CSHARP_LS: ServerDef = {
	name: "csharp-ls",
	command: "csharp-ls",
	rootMarkers: ["*.sln", "*.slnx", "*.csproj"],
	isLinter: false,
	disabled: false,
};

const OMNISHARP_OFF: ServerDef = {
	name: "omnisharp",
	command: "omnisharp",
	rootMarkers: ["*.sln", "*.csproj", ".git"],
	isLinter: false,
	disabled: true,
};

describe("hasRootMarkers", () => {
	test("matches plain filenames", () => {
		const fs = fixtureFs({ "/r": ["package.json"] });
		expect(hasRootMarkers("/r", ["package.json"], fs)).toBe(true);
		expect(hasRootMarkers("/r", ["tsconfig.json"], fs)).toBe(false);
	});

	test("matches single-segment glob markers", () => {
		const fs = fixtureFs({ "/r": ["app.csproj"] });
		expect(hasRootMarkers("/r", ["*.csproj"], fs)).toBe(true);
		expect(hasRootMarkers("/r", ["*.sln"], fs)).toBe(false);
	});

	test("returns false when directory is missing", () => {
		const fs = fixtureFs({});
		expect(hasRootMarkers("/missing", ["package.json"], fs)).toBe(false);
	});

	test("escapes regex metacharacters in literal segments of a glob", () => {
		// "a.b.csproj" must match `*.csproj` but not the literal `*+.csproj`.
		const fs = fixtureFs({ "/r": ["a.b.csproj"] });
		expect(hasRootMarkers("/r", ["*.csproj"], fs)).toBe(true);
		expect(hasRootMarkers("/r", ["+.csproj"], fs)).toBe(false);
	});
});

describe("detectServersAt", () => {
	test("partitions by binary resolution", () => {
		const fs = fixtureFs({ "/r": ["package.json", "tsconfig.json"] });
		const path = fixturePath([]); // nothing installed
		const detected = detectServersAt("/r", [TS_SERVER], fs, path);
		expect(detected).toEqual([
			{
				name: "typescript-language-server",
				command: "typescript-language-server",
				resolved: null,
				reason: "matched-no-binary",
			},
		]);
	});

	test("reports active when binary is on $PATH", () => {
		const fs = fixtureFs({ "/r": ["package.json"] });
		const path = fixturePath(["typescript-language-server"]);
		const detected = detectServersAt("/r", [TS_SERVER], fs, path);
		expect(detected[0]?.reason).toBe("matched-and-resolved");
		expect(detected[0]?.resolved).toBe("/fixture/bin/typescript-language-server");
	});

	test("excludes disabled servers entirely", () => {
		const fs = fixtureFs({ "/r": ["app.sln", ".git"] });
		const path = fixturePath(["omnisharp", "csharp-ls"]);
		const detected = detectServersAt("/r", [OMNISHARP_OFF, CSHARP_LS], fs, path);
		expect(detected.map(s => s.name)).toEqual(["csharp-ls"]);
	});

	test("does not match svelte on bare package.json after tightening", () => {
		const fs = fixtureFs({ "/r": ["package.json"] });
		const path = fixturePath(["svelteserver"]);
		const detected = detectServersAt("/r", [SVELTE_TIGHT], fs, path);
		expect(detected).toEqual([]);
	});
});

describe("classifyActivity", () => {
	const now = new Date("2026-05-15T00:00:00Z");

	test("active = within 90d", () => {
		expect(classifyActivity(new Date("2026-04-01T00:00:00Z"), now)).toBe("active");
	});

	test("warm = 90–365d", () => {
		expect(classifyActivity(new Date("2025-10-01T00:00:00Z"), now)).toBe("warm");
	});

	test("dormant = >365d", () => {
		expect(classifyActivity(new Date("2024-01-01T00:00:00Z"), now)).toBe("dormant");
	});

	test("null commit date is dormant", () => {
		expect(classifyActivity(null, now)).toBe("dormant");
	});

	test("respects custom thresholds", () => {
		const tight = { activeDays: 7, warmDays: 30 };
		expect(classifyActivity(new Date("2026-05-10T00:00:00Z"), now, tight)).toBe("active");
		expect(classifyActivity(new Date("2026-05-01T00:00:00Z"), now, tight)).toBe("warm");
		expect(classifyActivity(new Date("2026-03-01T00:00:00Z"), now, tight)).toBe("dormant");
	});
});

describe("auditFleet", () => {
	test("walks repo root + sub-packages and assigns activity", () => {
		const fs = fixtureFs({
			"/p/repo-a": ["package.json", ".git"],
			"/p/repo-a/packages/x": ["package.json"],
			"/p/repo-a/packages/y": ["package.json"],
		});
		const path = fixturePath(["typescript-language-server"]);
		const now = new Date("2026-05-15T00:00:00Z");
		const reports = auditFleet(
			[
				{
					label: "repo-a",
					path: "/p/repo-a",
					lastCommitAt: new Date("2026-05-01T00:00:00Z"),
					subPackages: ["/p/repo-a/packages/x", "/p/repo-a/packages/y"],
				},
			],
			() => [TS_SERVER],
			fs,
			path,
			now,
		);

		expect(reports).toHaveLength(1);
		const r = reports[0];
		if (!r) throw new Error("expected one report");
		expect(r.activity).toBe("active");
		expect(r.directories.map(d => d.relPath)).toEqual(["/", "packages/x", "packages/y"]);
		expect(r.directories.every(d => d.activeServers.length === 1)).toBe(true);
		expect(r.directories.every(d => d.unresolvedServers.length === 0)).toBe(true);
	});

	test("flags coverage gaps when binary is missing", () => {
		const fs = fixtureFs({ "/p/repo": ["package.json"] });
		const path = fixturePath([]); // nothing on $PATH
		const now = new Date("2026-05-15T00:00:00Z");
		const reports = auditFleet(
			[{ label: "repo", path: "/p/repo", lastCommitAt: now, subPackages: [] }],
			() => [TS_SERVER],
			fs,
			path,
			now,
		);
		expect(reports[0]?.directories[0]?.unresolvedServers.map(s => s.name)).toEqual([
			"typescript-language-server",
		]);
	});

	test("defsFor is invoked per directory so per-repo overrides are honored", () => {
		const fs = fixtureFs({
			"/p/normal": ["package.json"],
			"/p/deno-only": ["deno.json"],
		});
		const path = fixturePath(["typescript-language-server", "deno"]);
		const DENO: ServerDef = {
			name: "denols",
			command: "deno",
			rootMarkers: ["deno.json"],
			isLinter: false,
			disabled: false,
		};
		// /p/normal sees a standard TS toolchain; /p/deno-only pins to denols and
		// turns the TS server off. This is the per-cwd override pattern OMP
		// resolves through `loadConfig(cwd)`.
		const defsFor = (cwd: string): ServerDef[] => {
			if (cwd === "/p/deno-only") return [DENO, { ...TS_SERVER, disabled: true }];
			return [TS_SERVER];
		};
		const now = new Date("2026-05-15T00:00:00Z");
		const reports = auditFleet(
			[
				{ label: "normal", path: "/p/normal", lastCommitAt: now, subPackages: [] },
				{ label: "deno-only", path: "/p/deno-only", lastCommitAt: now, subPackages: [] },
			],
			defsFor,
			fs,
			path,
			now,
		);
		expect(reports[0]?.directories[0]?.activeServers.map(s => s.name)).toEqual([
			"typescript-language-server",
		]);
		expect(reports[1]?.directories[0]?.activeServers.map(s => s.name)).toEqual(["denols"]);
		expect(reports[1]?.directories[0]?.unresolvedServers).toHaveLength(0);
	});

	test("PathResolver receives cwd so local-bin precedence can be tested", () => {
		const fs = fixtureFs({ "/p/local": ["package.json", "tsconfig.json"] });
		const path = fixturePath(
			[], // nothing on global $PATH
			{
				"/p/local::typescript-language-server": "/p/local/node_modules/.bin/typescript-language-server",
			},
		);
		const now = new Date("2026-05-15T00:00:00Z");
		const reports = auditFleet(
			[{ label: "local", path: "/p/local", lastCommitAt: now, subPackages: [] }],
			() => [TS_SERVER],
			fs,
			path,
			now,
		);
		expect(reports[0]?.directories[0]?.activeServers[0]?.resolved).toBe(
			"/p/local/node_modules/.bin/typescript-language-server",
		);
	});
});

describe("renderReport", () => {
	test("groups by activity and surfaces coverage gaps", () => {
		const fs = fixtureFs({
			"/p/active-repo": ["package.json"],
			"/p/dormant-repo": ["package.json"],
		});
		const path = fixturePath([]);
		const now = new Date("2026-05-15T00:00:00Z");
		const reports = auditFleet(
			[
				{
					label: "active-repo",
					path: "/p/active-repo",
					lastCommitAt: new Date("2026-05-10T00:00:00Z"),
					subPackages: [],
				},
				{
					label: "dormant-repo",
					path: "/p/dormant-repo",
					lastCommitAt: new Date("2020-01-01T00:00:00Z"),
					subPackages: [],
				},
			],
			() => [TS_SERVER],
			fs,
			path,
			now,
			DEFAULT_ACTIVITY,
		);
		const out = renderReport(reports, now);
		expect(out).toContain("ACTIVE (1)");
		expect(out).toContain("DORMANT (1)");
		expect(out).toContain("active-repo");
		expect(out).toContain("dormant-repo");
		expect(out).toContain("COVERAGE GAPS");
		expect(out).toContain("typescript-language-server");
	});

	test("celebrates when no gaps remain", () => {
		const fs = fixtureFs({ "/p/r": ["package.json"] });
		const path = fixturePath(["typescript-language-server"]);
		const now = new Date("2026-05-15T00:00:00Z");
		const reports = auditFleet(
			[{ label: "r", path: "/p/r", lastCommitAt: now, subPackages: [] }],
			() => [TS_SERVER],
			fs,
			path,
			now,
		);
		const out = renderReport(reports, now);
		expect(out).toContain("All active repos have full binary coverage.");
		expect(out).not.toContain("COVERAGE GAPS");
	});
});

describe("extractTomlTable", () => {
	test("returns the table body up to the next top-level header", () => {
		const toml = `[package]\nname = "x"\n\n[workspace]\nmembers = ["a", "b"]\nexclude = ["c"]\n\n[dependencies]\nfoo = "1"\n`;
		const body = extractTomlTable(toml, "workspace");
		expect(body).toContain(`members = ["a", "b"]`);
		expect(body).toContain(`exclude = ["c"]`);
		expect(body).not.toContain("[package]");
		expect(body).not.toContain("[dependencies]");
	});

	test("returns the table body through end-of-file when no next header", () => {
		const toml = `[package]\nname = "x"\n\n[workspace]\nmembers = ["a"]\n`;
		const body = extractTomlTable(toml, "workspace");
		expect(body).not.toBeNull();
		expect(body).toContain(`members = ["a"]`);
	});

	test("returns null when the table is absent", () => {
		expect(extractTomlTable(`[package]\nname = "x"\n`, "workspace")).toBeNull();
	});

	test("escapes regex metacharacters in the table name", () => {
		const toml = `[target."cfg(unix)"]\nfoo = 1\n`;
		// Not asking for the dotted-cfg target here; just confirming that a name
		// containing regex metacharacters does not accidentally match.
		expect(extractTomlTable(toml, "target.cfg")).toBeNull();
	});
});

describe("parseGradleIncludeArgs", () => {
	test("captures every quoted segment in a variadic call", () => {
		expect(parseGradleIncludeArgs(`':a', ':b', ':c'`)).toEqual([":a", ":b", ":c"]);
	});

	test("handles Kotlin DSL double-quoted args", () => {
		expect(parseGradleIncludeArgs(`":a", ":b"`)).toEqual([":a", ":b"]);
	});

	test("returns an empty list when no quoted segments are present", () => {
		expect(parseGradleIncludeArgs("project(foo)")).toEqual([]);
	});
});

describe("parseGradleIncludeCalls", () => {
	test("captures a single-line paren call", () => {
		expect(parseGradleIncludeCalls(`include(":app", ":lib")`)).toEqual([`":app", ":lib"`]);
	});

	test("captures a multi-line paren call", () => {
		const text = `include(\n  ":app",\n  ":lib",\n)\n`;
		const [body] = parseGradleIncludeCalls(text);
		expect(body).toBeDefined();
		expect(parseGradleIncludeArgs(body ?? "")).toEqual([":app", ":lib"]);
	});

	test("captures Groovy no-paren form", () => {
		const [body] = parseGradleIncludeCalls(`include ':app', ':lib'\n`);
		expect(parseGradleIncludeArgs(body ?? "")).toEqual([":app", ":lib"]);
	});

	test("returns one body per include call", () => {
		const text = `include ':a'\ninclude(\n  ':b',\n  ':c',\n)\n`;
		const all = parseGradleIncludeCalls(text).flatMap(parseGradleIncludeArgs);
		expect(all).toEqual([":b", ":c", ":a"]);
	});
});

describe("auditFleet — per-cwd defs across one repo", () => {
	test("each sub-package's defs are computed independently", () => {
		const fs = fixtureFs({
			"/r": ["package.json", ".git"],
			"/r/strict": ["package.json"],
			"/r/relaxed": ["package.json"],
		});
		const path = fixturePath(["typescript-language-server", "ruff"]);
		const RUFF: ServerDef = {
			name: "ruff",
			command: "ruff",
			rootMarkers: ["package.json"],
			isLinter: true,
			disabled: false,
		};
		// `/r/strict` is configured (via a hypothetical project-local lsp.json)
		// to disable the TS server; `/r/relaxed` adds ruff in addition to TS.
		const defsFor = (cwd: string): ServerDef[] => {
			if (cwd === "/r/strict") return [{ ...TS_SERVER, disabled: true }];
			if (cwd === "/r/relaxed") return [TS_SERVER, RUFF];
			return [TS_SERVER];
		};
		const now = new Date("2026-05-15T00:00:00Z");
		const reports = auditFleet(
			[
				{
					label: "r",
					path: "/r",
					lastCommitAt: now,
					subPackages: ["/r/strict", "/r/relaxed"],
				},
			],
			defsFor,
			fs,
			path,
			now,
		);
		const dirs = reports[0]?.directories ?? [];
		const byRel = Object.fromEntries(dirs.map(d => [d.relPath, d.activeServers.map(s => s.name)]));
		expect(byRel["/"]).toEqual(["typescript-language-server"]);
		expect(byRel.strict).toEqual([]);
		expect(byRel.relaxed).toEqual(["typescript-language-server", "ruff"]);
	});
});
