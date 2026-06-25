---
title: Hindsight + Codex Local Memory Integration Implementation Plan
type: plan
status: abandoned
created: 2026-05-26
parent: 2026-05-26-hindsight-codex-local-integration-design
superseded_by:
archived: 2026-06-25
---

# Hindsight + Codex Local Memory Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make this repo manage a localhost-only Hindsight API backed by Codex subscription auth, manage the localhost Hindsight Control Plane UI, and switch managed OMP config to `memory.backend: "hindsight"`.

**Architecture:** Keep pure decisions in `src/hindsight-service.ts`: constants, plist rendering, idempotent write plans, status classification, command summaries. Keep real IO in `src/hindsight-service-runtime.ts`: filesystem, `Bun.which`, `uv`, `pnpm dlx`, `launchctl`, bounded log reads, HTTP health probes, and URL opening. CLI glue in `src/cli.ts` delegates to the runtime and remains thin; config/bootstrap stay the source of truth for OMP memory backend deployment.

**Tech Stack:** Bun, TypeScript, `bun:test`, macOS LaunchAgents, `uv tool install hindsight-api`, pinned `pnpm dlx @vectorize-io/hindsight-control-plane@0.6.2`, Codex subscription auth via `~/.codex/auth.json`.

---

## File structure

- Create `src/hindsight-service.ts`: pure constants, types, XML escaping, LaunchAgent plist rendering, write-plan classification, health/Codex/status classifiers, log slicing, and human-readable summaries.
- Create `src/hindsight-service-runtime.ts`: real adapters for command lookup, tool installation/preflight, plist writes, launchctl bootstrap/bootout, HTTP checks, log reads, and platform URL opening.
- Create `tests/hindsight-service.test.ts`: unit tests for pure plist rendering, idempotency, status classification, Codex auth classification, bounded log slicing, and command summaries.
- Create `tests/hindsight-service-runtime.test.ts`: temp-directory and fake-runner tests for runtime orchestration without real Codex/Hindsight/network/model calls.
- Modify `src/cli.ts`: add `hindsight` nested subcommands, wire doctor Hindsight checks, add deterministic verify checks only.
- Modify `package.json`: add `hindsight:*` scripts pointing at `bun run src/cli.ts hindsight <subcommand>`.
- Modify `src/config.ts`: change managed `memory.backend` from `off` to `hindsight`; keep `MANAGED_KEYS` unchanged.
- Modify `config/config.yml.template`: change documented managed memory backend to `hindsight`.
- Modify `tests/config.test.ts`: update expectations and add an explicit test that `hindsight` is not a managed top-level key.
- Modify `tests/cli.test.ts`: cover CLI subcommand parsing/help through exported pure helpers; keep real service operations behind runtime injection.
- Modify `README.md`: add setup/operation commands and requirements for `codex`, `uv`, and `pnpm`.
- Modify `AGENTS.md`: add Hindsight operational note and boundary rows for LaunchAgents and deployed config.

---

## Phase 1: Pure Hindsight service model

### Task 1: Add pure constants, plist rendering, and write-plan tests

**Files:**
- Create: `src/hindsight-service.ts`
- Create: `tests/hindsight-service.test.ts`

- [ ] **Step 1: Write failing tests for constants and API plist rendering**

Add `tests/hindsight-service.test.ts` with this initial content:

```ts
import { describe, expect, test } from "bun:test";
import {
	API_ENV,
	API_LABEL,
	CONTROL_PLANE_LABEL,
	CONTROL_PLANE_PACKAGE,
	renderApiPlist,
	renderControlPlanePlist,
} from "../src/hindsight-service.ts";

describe("Hindsight LaunchAgent rendering", () => {
	test("renders the API plist with absolute executable, localhost env, and crash-only keepalive", () => {
		const plist = renderApiPlist({
			hindsightApiPath: "/Users/me/.local/bin/hindsight-api",
			stdoutPath: "/Users/me/.omp/logs/hindsight.out.log",
			stderrPath: "/Users/me/.omp/logs/hindsight.err.log",
		});

		expect(plist).toContain(`<string>${API_LABEL}</string>`);
		expect(plist).toContain("<string>/Users/me/.local/bin/hindsight-api</string>");
		expect(plist).toContain("<key>RunAtLoad</key>\n\t<true/>");
		expect(plist).toContain("<key>SuccessfulExit</key>\n\t\t<false/>");
		expect(plist).toContain("<key>HINDSIGHT_API_HOST</key>\n\t\t<string>127.0.0.1</string>");
		expect(plist).toContain("<key>HINDSIGHT_API_PORT</key>\n\t\t<string>8888</string>");
		expect(plist).toContain("<key>HINDSIGHT_API_LLM_PROVIDER</key>\n\t\t<string>openai-codex</string>");
		expect(plist).toContain("<key>HINDSIGHT_API_WORKER_ID</key>\n\t\t<string>omp-hindsight-local</string>");
		expect(plist).toContain("<key>HINDSIGHT_API_LOG_LEVEL</key>\n\t\t<string>info</string>");
		for (const value of Object.values(API_ENV)) expect(plist).toContain(`<string>${value}</string>`);
	});

	test("renders the control plane plist with pinned pnpm dlx and localhost binding", () => {
		const plist = renderControlPlanePlist({
			pnpmPath: "/opt/homebrew/bin/pnpm",
			stdoutPath: "/Users/me/.omp/logs/hindsight-control-plane.out.log",
			stderrPath: "/Users/me/.omp/logs/hindsight-control-plane.err.log",
		});

		expect(plist).toContain(`<string>${CONTROL_PLANE_LABEL}</string>`);
		expect(plist).toContain("<string>/opt/homebrew/bin/pnpm</string>");
		expect(plist).toContain("<string>dlx</string>");
		expect(plist).toContain(`<string>${CONTROL_PLANE_PACKAGE}</string>`);
		expect(plist).toContain("<string>--api-url</string>\n\t\t<string>http://127.0.0.1:8888</string>");
		expect(plist).toContain("<string>--hostname</string>\n\t\t<string>127.0.0.1</string>");
		expect(plist).toContain("<string>--port</string>\n\t\t<string>9999</string>");
		expect(plist).not.toContain("HINDSIGHT_CP_ACCESS_KEY");
	});
});
```

- [ ] **Step 2: Run the new test and verify it fails because the module is missing**

Run:

```bash
bun test tests/hindsight-service.test.ts
```

Expected: fail with an import error for `../src/hindsight-service.ts`.

- [ ] **Step 3: Create the pure module with exact constants and renderers**

Create `src/hindsight-service.ts` with these exports first:

```ts
export const API_LABEL = "io.glockyco.omp.hindsight";
export const CONTROL_PLANE_LABEL = "io.glockyco.omp.hindsight-control-plane";
export const CONTROL_PLANE_PACKAGE = "@vectorize-io/hindsight-control-plane@0.6.2";
export const API_URL = "http://127.0.0.1:8888";
export const CONTROL_PLANE_URL = "http://127.0.0.1:9999";

export const API_ENV = {
	HINDSIGHT_API_HOST: "127.0.0.1",
	HINDSIGHT_API_PORT: "8888",
	HINDSIGHT_API_LLM_PROVIDER: "openai-codex",
	HINDSIGHT_API_WORKER_ID: "omp-hindsight-local",
	HINDSIGHT_API_LOG_LEVEL: "info",
} as const;

export interface ApiPlistOptions {
	hindsightApiPath: string;
	stdoutPath: string;
	stderrPath: string;
}

export interface ControlPlanePlistOptions {
	pnpmPath: string;
	stdoutPath: string;
	stderrPath: string;
}

function escapeXml(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function plistString(value: string): string {
	return `<string>${escapeXml(value)}</string>`;
}

function renderProgramArguments(args: readonly string[]): string {
	return [`\t<key>ProgramArguments</key>`, `\t<array>`, ...args.map(arg => `\t\t${plistString(arg)}`), `\t</array>`].join("\n");
}

function renderCrashOnlyKeepAlive(): string {
	return [
		`\t<key>RunAtLoad</key>`,
		`\t<true/>`,
		`\t<key>KeepAlive</key>`,
		`\t<dict>`,
		`\t\t<key>SuccessfulExit</key>`,
		`\t\t<false/>`,
		`\t</dict>`,
	].join("\n");
}

function wrapPlist(label: string, programArguments: readonly string[], body: readonly string[]): string {
	return [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">`,
		`<plist version="1.0">`,
		`<dict>`,
		`\t<key>Label</key>`,
		`\t${plistString(label)}`,
		renderProgramArguments(programArguments),
		...body,
		`</dict>`,
		`</plist>`,
		``,
	].join("\n");
}

export function renderApiPlist(options: ApiPlistOptions): string {
	const envLines = Object.entries(API_ENV).flatMap(([key, value]) => [
		`\t\t<key>${key}</key>`,
		`\t\t${plistString(value)}`,
	]);
	return wrapPlist(API_LABEL, [options.hindsightApiPath], [
		renderCrashOnlyKeepAlive(),
		`\t<key>EnvironmentVariables</key>`,
		`\t<dict>`,
		...envLines,
		`\t</dict>`,
		`\t<key>StandardOutPath</key>`,
		`\t${plistString(options.stdoutPath)}`,
		`\t<key>StandardErrorPath</key>`,
		`\t${plistString(options.stderrPath)}`,
	]);
}

export function renderControlPlanePlist(options: ControlPlanePlistOptions): string {
	return wrapPlist(
		CONTROL_PLANE_LABEL,
		[
			options.pnpmPath,
			"dlx",
			CONTROL_PLANE_PACKAGE,
			"--api-url",
			API_URL,
			"--hostname",
			"127.0.0.1",
			"--port",
			"9999",
		],
		[
			renderCrashOnlyKeepAlive(),
			`\t<key>StandardOutPath</key>`,
			`\t${plistString(options.stdoutPath)}`,
			`\t<key>StandardErrorPath</key>`,
			`\t${plistString(options.stderrPath)}`,
		],
	);
}
```

- [ ] **Step 4: Run the renderer tests and verify they pass**

Run:

```bash
bun test tests/hindsight-service.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit the pure renderer slice**

Run:

```bash
git add src/hindsight-service.ts tests/hindsight-service.test.ts
git commit -m "feat: render hindsight launch agents"
```

### Task 2: Add pure write plans, status classification, and summaries

**Files:**
- Modify: `src/hindsight-service.ts`
- Modify: `tests/hindsight-service.test.ts`

- [ ] **Step 1: Add failing tests for write plans and classifiers**

Append to `tests/hindsight-service.test.ts`:

```ts
describe("Hindsight service planning", () => {
	test("classifies plist writes as create, update, or unchanged", () => {
		expect(classifyPlistWrite({ path: "/a.plist", desired: "new", existing: null })).toEqual({
			kind: "create",
			path: "/a.plist",
			desired: "new",
		});
		expect(classifyPlistWrite({ path: "/a.plist", desired: "new", existing: "old" })).toEqual({
			kind: "update",
			path: "/a.plist",
			desired: "new",
		});
		expect(classifyPlistWrite({ path: "/a.plist", desired: "same", existing: "same" })).toEqual({
			kind: "unchanged",
			path: "/a.plist",
			desired: "same",
		});
	});

	test("classifies health checks without requiring model calls", () => {
		expect(classifyHealth({ ok: true, status: 200 })).toEqual({ state: "reachable", detail: "HTTP 200" });
		expect(classifyHealth({ ok: true, status: 404 })).toEqual({ state: "reachable", detail: "HTTP 404" });
		expect(classifyHealth({ ok: false, error: "ECONNREFUSED" })).toEqual({ state: "unreachable", detail: "ECONNREFUSED" });
		expect(classifyHealth({ ok: false, timedOut: true })).toEqual({ state: "timeout", detail: "request timed out" });
	});

	test("classifies Codex auth from command and auth-file presence", () => {
		expect(classifyCodexAuth({ codexPath: null, authJsonExists: false })).toEqual({
			state: "missing-codex",
			detail: "codex executable not found on PATH",
		});
		expect(classifyCodexAuth({ codexPath: "/opt/homebrew/bin/codex", authJsonExists: false })).toEqual({
			state: "missing-auth",
			detail: "Run `codex login` and ensure file-based Codex credentials are available at ~/.codex/auth.json. Treat that file as a secret; this repo will not copy or commit it.",
		});
		expect(classifyCodexAuth({ codexPath: "/opt/homebrew/bin/codex", authJsonExists: true })).toEqual({
			state: "ready",
			detail: "Codex auth file present at ~/.codex/auth.json",
		});
	});

	test("returns bounded recent log lines", () => {
		const text = Array.from({ length: 25 }, (_, index) => `line-${index + 1}`).join("\n");
		expect(recentLogLines(text, 3)).toEqual(["line-23", "line-24", "line-25"]);
		expect(recentLogLines("", 3)).toEqual([]);
	});
});
```

Update the import from `../src/hindsight-service.ts` to include:

```ts
classifyCodexAuth,
classifyHealth,
classifyPlistWrite,
recentLogLines,
```

- [ ] **Step 2: Run the tests and verify missing exports fail**

Run:

```bash
bun test tests/hindsight-service.test.ts
```

Expected: fail because `classifyCodexAuth`, `classifyHealth`, `classifyPlistWrite`, or `recentLogLines` is not exported.

- [ ] **Step 3: Add pure planning and classification exports**

Append to `src/hindsight-service.ts`:

```ts
export type PlistWriteKind = "create" | "update" | "unchanged";

export interface PlistWriteInput {
	path: string;
	desired: string;
	existing: string | null;
}

export interface PlistWritePlan {
	kind: PlistWriteKind;
	path: string;
	desired: string;
}

export function classifyPlistWrite(input: PlistWriteInput): PlistWritePlan {
	return {
		kind: input.existing === null ? "create" : input.existing === input.desired ? "unchanged" : "update",
		path: input.path,
		desired: input.desired,
	};
}

export interface RawHealthResult {
	ok: boolean;
	status?: number;
	error?: string;
	timedOut?: boolean;
}

export interface ClassifiedHealth {
	state: "reachable" | "unreachable" | "timeout";
	detail: string;
}

export function classifyHealth(result: RawHealthResult): ClassifiedHealth {
	if (result.ok) return { state: "reachable", detail: `HTTP ${result.status}` };
	if (result.timedOut) return { state: "timeout", detail: "request timed out" };
	return { state: "unreachable", detail: result.error || "request failed" };
}

export interface CodexAuthInput {
	codexPath: string | null;
	authJsonExists: boolean;
}

export interface CodexAuthStatus {
	state: "ready" | "missing-codex" | "missing-auth";
	detail: string;
}

export function classifyCodexAuth(input: CodexAuthInput): CodexAuthStatus {
	if (!input.codexPath) return { state: "missing-codex", detail: "codex executable not found on PATH" };
	if (!input.authJsonExists) {
		return {
			state: "missing-auth",
			detail:
				"Run `codex login` and ensure file-based Codex credentials are available at ~/.codex/auth.json. Treat that file as a secret; this repo will not copy or commit it.",
		};
	}
	return { state: "ready", detail: "Codex auth file present at ~/.codex/auth.json" };
}

export function recentLogLines(text: string, maxLines: number): string[] {
	const lines = text.split(/\r?\n/).filter(line => line.length > 0);
	return lines.slice(Math.max(0, lines.length - maxLines));
}
```

- [ ] **Step 4: Run the pure Hindsight tests**

Run:

```bash
bun test tests/hindsight-service.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit the pure planning slice**

Run:

```bash
git add src/hindsight-service.ts tests/hindsight-service.test.ts
git commit -m "feat: classify hindsight service state"
```

---

## Phase 2: Runtime service orchestration

### Task 3: Add runtime adapter with fakeable command runner

**Files:**
- Create: `src/hindsight-service-runtime.ts`
- Create: `tests/hindsight-service-runtime.test.ts`

- [ ] **Step 1: Write failing runtime orchestration tests with fakes**

Create `tests/hindsight-service-runtime.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { API_LABEL, CONTROL_PLANE_LABEL } from "../src/hindsight-service.ts";
import { createHindsightRuntime, hindsightPaths } from "../src/hindsight-service-runtime.ts";

interface RunCall {
	command: string;
	args: readonly string[];
}

let home: string;
let calls: RunCall[];

beforeEach(async () => {
	home = await mkdtemp(join(tmpdir(), "omp-hindsight-"));
	calls = [];
});

afterEach(async () => {
	await rm(home, { recursive: true, force: true });
});

function runtime() {
	return createHindsightRuntime({
		home,
		which: async name => {
			if (name === "uv") return "/opt/homebrew/bin/uv";
			if (name === "pnpm") return "/opt/homebrew/bin/pnpm";
			if (name === "codex") return "/opt/homebrew/bin/codex";
			if (name === "hindsight-api") return "/Users/me/.local/bin/hindsight-api";
			return null;
		},
		run: async (command, args) => {
			calls.push({ command, args });
			return { exitCode: 0, stdout: "/Users/me/.local/bin/hindsight-api\n", stderr: "" };
		},
		health: async url => ({ ok: true, status: url.includes("9999") ? 200 : 204 }),
		openUrl: async () => true,
	});
}

describe("hindsight-service-runtime", () => {
	test("computes owned paths under the supplied home", () => {
		const paths = hindsightPaths(home);
		expect(paths.apiPlistPath).toBe(join(home, "Library", "LaunchAgents", "io.glockyco.omp.hindsight.plist"));
		expect(paths.controlPlanePlistPath).toBe(join(home, "Library", "LaunchAgents", "io.glockyco.omp.hindsight-control-plane.plist"));
		expect(paths.logsDir).toBe(join(home, ".omp", "logs"));
	});

	test("install writes plists, preflights pnpm dlx, bootstraps both services, and checks health", async () => {
		await mkdir(join(home, ".codex"), { recursive: true });
		await writeFile(join(home, ".codex", "auth.json"), "secret marker not read by implementation");
		const result = await runtime().install();

		const paths = hindsightPaths(home);
		expect(await readFile(paths.apiPlistPath, "utf8")).toContain(`<string>${API_LABEL}</string>`);
		expect(await readFile(paths.controlPlanePlistPath, "utf8")).toContain(`<string>${CONTROL_PLANE_LABEL}</string>`);
		expect(calls.map(call => [call.command, ...call.args])).toContainEqual([
			"/opt/homebrew/bin/uv",
			"tool",
			"install",
			"hindsight-api",
		]);
		expect(calls.map(call => [call.command, ...call.args])).toContainEqual([
			"/opt/homebrew/bin/pnpm",
			"dlx",
			"@vectorize-io/hindsight-control-plane@0.6.2",
			"--help",
		]);
		expect(calls.map(call => [call.command, ...call.args])).toContainEqual([
			"launchctl",
			"bootstrap",
			`gui/${process.getuid()}`,
			paths.apiPlistPath,
		]);
		expect(result.apiHealth.state).toBe("reachable");
		expect(result.controlPlaneHealth.state).toBe("reachable");
	});

	test("install refuses to proceed when Codex auth file is missing", async () => {
		await expect(runtime().install()).rejects.toThrow(/codex login/);
	});
});
```

- [ ] **Step 2: Run the runtime test and verify missing module failure**

Run:

```bash
bun test tests/hindsight-service-runtime.test.ts
```

Expected: fail with an import error for `src/hindsight-service-runtime.ts`.

- [ ] **Step 3: Implement the runtime adapter using injected IO**

Create `src/hindsight-service-runtime.ts` with these public shapes and behavior:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	API_LABEL,
	API_URL,
	CONTROL_PLANE_LABEL,
	CONTROL_PLANE_PACKAGE,
	CONTROL_PLANE_URL,
	classifyCodexAuth,
	classifyHealth,
	classifyPlistWrite,
	recentLogLines,
	renderApiPlist,
	renderControlPlanePlist,
	type ClassifiedHealth,
	type CodexAuthStatus,
	type PlistWritePlan,
	type RawHealthResult,
} from "./hindsight-service.ts";

export interface RuntimeCommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export interface RuntimeDeps {
	home: string;
	which(name: string): Promise<string | null>;
	run(command: string, args: readonly string[]): Promise<RuntimeCommandResult>;
	health(url: string): Promise<RawHealthResult>;
	openUrl(url: string): Promise<boolean>;
}

export interface HindsightPaths {
	launchAgentsDir: string;
	logsDir: string;
	apiPlistPath: string;
	controlPlanePlistPath: string;
	apiOutLog: string;
	apiErrLog: string;
	controlPlaneOutLog: string;
	controlPlaneErrLog: string;
	authJsonPath: string;
}

export interface InstallResult {
	hindsightApiPath: string;
	pnpmPath: string;
	apiPlist: PlistWritePlan;
	controlPlanePlist: PlistWritePlan;
	codex: CodexAuthStatus;
	apiHealth: ClassifiedHealth;
	controlPlaneHealth: ClassifiedHealth;
}

export function hindsightPaths(home: string): HindsightPaths {
	const logsDir = join(home, ".omp", "logs");
	const launchAgentsDir = join(home, "Library", "LaunchAgents");
	return {
		launchAgentsDir,
		logsDir,
		apiPlistPath: join(launchAgentsDir, `${API_LABEL}.plist`),
		controlPlanePlistPath: join(launchAgentsDir, `${CONTROL_PLANE_LABEL}.plist`),
		apiOutLog: join(logsDir, "hindsight.out.log"),
		apiErrLog: join(logsDir, "hindsight.err.log"),
		controlPlaneOutLog: join(logsDir, "hindsight-control-plane.out.log"),
		controlPlaneErrLog: join(logsDir, "hindsight-control-plane.err.log"),
		authJsonPath: join(home, ".codex", "auth.json"),
	};
}

async function readExisting(path: string): Promise<string | null> {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
}

async function exists(path: string): Promise<boolean> {
	try {
		await readFile(path, "utf8");
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
}

async function writeIfChanged(plan: PlistWritePlan): Promise<void> {
	if (plan.kind !== "unchanged") await writeFile(plan.path, plan.desired);
}

export function createHindsightRuntime(deps: RuntimeDeps) {
	const paths = hindsightPaths(deps.home);
	const domain = `gui/${process.getuid()}`;

	async function requireTool(name: string): Promise<string> {
		const path = await deps.which(name);
		if (!path) throw new Error(`Required executable not found on PATH: ${name}`);
		return path;
	}

	async function codexStatus(): Promise<CodexAuthStatus> {
		return classifyCodexAuth({ codexPath: await deps.which("codex"), authJsonExists: await exists(paths.authJsonPath) });
	}

	async function install(): Promise<InstallResult> {
		const uvPath = await requireTool("uv");
		const pnpmPath = await requireTool("pnpm");
		const codex = await codexStatus();
		if (codex.state !== "ready") throw new Error(codex.detail);

		await deps.run(uvPath, ["tool", "install", "hindsight-api"]);
		let hindsightApiPath = await deps.which("hindsight-api");
		if (!hindsightApiPath) {
			const resolved = await deps.run(uvPath, ["tool", "dir", "--bin"]);
			hindsightApiPath = join(resolved.stdout.trim(), "hindsight-api");
		}
		await deps.run(pnpmPath, ["dlx", CONTROL_PLANE_PACKAGE, "--help"]);

		await mkdir(paths.launchAgentsDir, { recursive: true });
		await mkdir(paths.logsDir, { recursive: true });
		const apiDesired = renderApiPlist({ hindsightApiPath, stdoutPath: paths.apiOutLog, stderrPath: paths.apiErrLog });
		const controlDesired = renderControlPlanePlist({ pnpmPath, stdoutPath: paths.controlPlaneOutLog, stderrPath: paths.controlPlaneErrLog });
		const apiPlist = classifyPlistWrite({ path: paths.apiPlistPath, desired: apiDesired, existing: await readExisting(paths.apiPlistPath) });
		const controlPlanePlist = classifyPlistWrite({ path: paths.controlPlanePlistPath, desired: controlDesired, existing: await readExisting(paths.controlPlanePlistPath) });
		await writeIfChanged(apiPlist);
		await writeIfChanged(controlPlanePlist);

		await deps.run("launchctl", ["bootout", domain, paths.apiPlistPath]);
		await deps.run("launchctl", ["bootout", domain, paths.controlPlanePlistPath]);
		await deps.run("launchctl", ["bootstrap", domain, paths.apiPlistPath]);
		await deps.run("launchctl", ["bootstrap", domain, paths.controlPlanePlistPath]);

		return {
			hindsightApiPath,
			pnpmPath,
			apiPlist,
			controlPlanePlist,
			codex,
			apiHealth: classifyHealth(await deps.health(API_URL)),
			controlPlaneHealth: classifyHealth(await deps.health(CONTROL_PLANE_URL)),
		};
	}

	async function start() {
		if (!(await exists(paths.apiPlistPath)) || !(await exists(paths.controlPlanePlistPath))) throw new Error("Hindsight LaunchAgents are missing; run `bun run hindsight:install`.");
		await deps.run("launchctl", ["bootstrap", domain, paths.apiPlistPath]);
		await deps.run("launchctl", ["bootstrap", domain, paths.controlPlanePlistPath]);
		return { apiHealth: classifyHealth(await deps.health(API_URL)), controlPlaneHealth: classifyHealth(await deps.health(CONTROL_PLANE_URL)) };
	}

	async function stop() {
		await deps.run("launchctl", ["bootout", domain, paths.controlPlanePlistPath]);
		await deps.run("launchctl", ["bootout", domain, paths.apiPlistPath]);
	}

	async function restart() {
		await stop();
		return await start();
	}

	return {
		install,
		start,
		stop,
		restart,
		async status() {
			return {
				paths,
				codex: await codexStatus(),
				apiPlistPresent: await exists(paths.apiPlistPath),
				controlPlanePlistPresent: await exists(paths.controlPlanePlistPath),
				apiHealth: classifyHealth(await deps.health(API_URL)),
				controlPlaneHealth: classifyHealth(await deps.health(CONTROL_PLANE_URL)),
			};
		},
		async logs(maxLines = 80) {
			return {
				paths,
				apiOut: recentLogLines((await readExisting(paths.apiOutLog)) || "", maxLines),
				apiErr: recentLogLines((await readExisting(paths.apiErrLog)) || "", maxLines),
				controlPlaneOut: recentLogLines((await readExisting(paths.controlPlaneOutLog)) || "", maxLines),
				controlPlaneErr: recentLogLines((await readExisting(paths.controlPlaneErrLog)) || "", maxLines),
			};
		},
		async ui() {
			const health = classifyHealth(await deps.health(CONTROL_PLANE_URL));
			return { health, opened: health.state === "reachable" ? await deps.openUrl(CONTROL_PLANE_URL) : false, url: CONTROL_PLANE_URL };
		},
	};
}
```

- [ ] **Step 4: Run runtime tests and fix only source-cause failures**

Run:

```bash
bun test tests/hindsight-service-runtime.test.ts
```

Expected: pass. If `launchctl bootout` fake expectations need exit-code tolerant behavior, encode that tolerance in runtime tests and implementation: bootout of an unloaded service is non-fatal, bootstrap failures are fatal.

- [ ] **Step 5: Commit runtime install orchestration**

Run:

```bash
git add src/hindsight-service-runtime.ts tests/hindsight-service-runtime.test.ts
git commit -m "feat: manage hindsight launch agents"
```

### Task 4: Complete start, stop, restart, status, logs, and ui runtime tests

**Files:**
- Modify: `src/hindsight-service-runtime.ts`
- Modify: `tests/hindsight-service-runtime.test.ts`

- [ ] **Step 1: Add failing tests for lifecycle operations**

Append tests that seed fake plist files and assert these facts:

```ts
test("start requires existing plists and bootstraps both services", async () => {
	const paths = hindsightPaths(home);
	await mkdir(paths.launchAgentsDir, { recursive: true });
	await writeFile(paths.apiPlistPath, "api");
	await writeFile(paths.controlPlanePlistPath, "cp");

	const result = await runtime().start();

	expect(calls.map(call => [call.command, ...call.args])).toContainEqual(["launchctl", "bootstrap", `gui/${process.getuid()}`, paths.apiPlistPath]);
	expect(calls.map(call => [call.command, ...call.args])).toContainEqual(["launchctl", "bootstrap", `gui/${process.getuid()}`, paths.controlPlanePlistPath]);
	expect(result.apiHealth.state).toBe("reachable");
});

test("stop boots out control plane before API and does not delete files", async () => {
	const paths = hindsightPaths(home);
	await mkdir(paths.launchAgentsDir, { recursive: true });
	await writeFile(paths.apiPlistPath, "api");
	await writeFile(paths.controlPlanePlistPath, "cp");

	await runtime().stop();

	expect(calls.map(call => [call.command, ...call.args])).toEqual([
		["launchctl", "bootout", `gui/${process.getuid()}`, paths.controlPlanePlistPath],
		["launchctl", "bootout", `gui/${process.getuid()}`, paths.apiPlistPath],
	]);
	expect(await readFile(paths.apiPlistPath, "utf8")).toBe("api");
});

test("logs returns bounded content from owned files", async () => {
	const paths = hindsightPaths(home);
	await mkdir(paths.logsDir, { recursive: true });
	await writeFile(paths.apiErrLog, ["one", "two", "three"].join("\n"));

	const result = await runtime().logs(2);

	expect(result.apiErr).toEqual(["two", "three"]);
	expect(result.paths.apiErrLog).toBe(paths.apiErrLog);
});

test("ui opens only when the control plane is reachable", async () => {
	const result = await runtime().ui();
	expect(result.opened).toBe(true);
	expect(result.url).toBe("http://127.0.0.1:9999");
});
```

- [ ] **Step 2: Run runtime tests**

Run:

```bash
bun test tests/hindsight-service-runtime.test.ts
```

Expected: pass after tightening runtime behavior around lifecycle order and bounded log reads.

- [ ] **Step 3: Commit lifecycle behavior**

Run:

```bash
git add src/hindsight-service-runtime.ts tests/hindsight-service-runtime.test.ts
git commit -m "feat: add hindsight lifecycle commands"
```

---

## Phase 3: CLI integration and scripts

### Task 5: Add `hindsight` nested CLI subcommands

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add failing CLI tests for command routing and scripts**

In `tests/cli.test.ts`, add tests for exported helpers rather than spawning the whole CLI:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { repoCommandNames, resolveHindsightSubcommand } from "../src/cli.ts";

describe("hindsight CLI routing", () => {
	test("exposes hindsight as a top-level command", () => {
		expect(repoCommandNames()).toContain("hindsight");
	});

	test("resolves supported hindsight subcommands", () => {
		for (const name of ["install", "start", "stop", "restart", "status", "logs", "ui"]) {
			expect(resolveHindsightSubcommand(name)).toBe(name);
		}
		expect(resolveHindsightSubcommand("unknown")).toBeNull();
	});

	test("package scripts invoke the Bun CLI hindsight subcommands", async () => {
		const pkg = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };
		expect(pkg.scripts["hindsight:install"]).toBe("bun run src/cli.ts hindsight install");
		expect(pkg.scripts["hindsight:start"]).toBe("bun run src/cli.ts hindsight start");
		expect(pkg.scripts["hindsight:stop"]).toBe("bun run src/cli.ts hindsight stop");
		expect(pkg.scripts["hindsight:restart"]).toBe("bun run src/cli.ts hindsight restart");
		expect(pkg.scripts["hindsight:status"]).toBe("bun run src/cli.ts hindsight status");
		expect(pkg.scripts["hindsight:logs"]).toBe("bun run src/cli.ts hindsight logs");
		expect(pkg.scripts["hindsight:ui"]).toBe("bun run src/cli.ts hindsight ui");
	});
});
```

- [ ] **Step 2: Run CLI tests and verify failure**

Run:

```bash
bun test tests/cli.test.ts
```

Expected: fail because the helpers or package scripts are absent.

- [ ] **Step 3: Export routing helpers and add package scripts**

In `src/cli.ts`, export pure helpers:

```ts
const HINDSIGHT_SUBCOMMANDS = ["install", "start", "stop", "restart", "status", "logs", "ui"] as const;
type HindsightSubcommand = (typeof HINDSIGHT_SUBCOMMANDS)[number];

export function resolveHindsightSubcommand(name: string | undefined): HindsightSubcommand | null {
	if (!name) return null;
	return HINDSIGHT_SUBCOMMANDS.includes(name as HindsightSubcommand) ? (name as HindsightSubcommand) : null;
}

export function repoCommandNames(): string[] {
	return Object.keys(COMMANDS).sort();
}
```

Add `hindsight: cmdHindsight` to `COMMANDS`. Implement `cmdHindsight(args)` by creating the real runtime and dispatching to `install`, `start`, `stop`, `restart`, `status`, `logs`, or `ui`. Keep output concise and secret-free: paths, plist write kinds, health states, URL, and remediation text only.

In `package.json`, add the seven scripts from the spec after `install-lsp`.

- [ ] **Step 4: Run CLI tests**

Run:

```bash
bun test tests/cli.test.ts
```

Expected: pass.

- [ ] **Step 5: Run TypeScript check for new exports and runtime imports**

Run:

```bash
bun run check:types
```

Expected: pass.

- [ ] **Step 6: Commit CLI scripts**

Run:

```bash
git add src/cli.ts tests/cli.test.ts package.json
git commit -m "feat: add hindsight CLI commands"
```

---

## Phase 4: Managed OMP config cutover

### Task 6: Switch managed memory backend to Hindsight

**Files:**
- Modify: `src/config.ts`
- Modify: `config/config.yml.template`
- Modify: `tests/config.test.ts`
- Modify: `tests/integration/bootstrap.test.ts` only if existing assertions need explicit wording

- [ ] **Step 1: Add failing config tests for Hindsight backend and unmanaged `hindsight` key**

In `tests/config.test.ts`, change the existing managed memory expectation to:

```ts
expect(readTopLevel(merged, "memory")).toEqual({ backend: "hindsight" });
```

Add this test:

```ts
test("does not manage top-level hindsight settings", () => {
	expect(MANAGED_KEYS).not.toContain("hindsight" as never);
	const merged = mergeManagedConfig("hindsight:\n  apiUrl: http://127.0.0.1:7777\n");
	expect(readTopLevel(merged, "hindsight")).toEqual({ apiUrl: "http://127.0.0.1:7777" });
});
```

- [ ] **Step 2: Run config tests and verify failure**

Run:

```bash
bun test tests/config.test.ts
```

Expected: fail because `MANAGED_CONFIG.memory.backend` is still `off`.

- [ ] **Step 3: Change the managed backend**

In `src/config.ts`, change:

```ts
memory: {
	backend: "off",
},
```

to:

```ts
memory: {
	backend: "hindsight",
},
```

In `config/config.yml.template`, change:

```yaml
memory:
  backend: "off"
```

to:

```yaml
memory:
  backend: "hindsight"
```

- [ ] **Step 4: Run config and bootstrap tests**

Run:

```bash
bun test tests/config.test.ts tests/integration/bootstrap.test.ts
```

Expected: pass. Bootstrap integration should pass through its imported `MANAGED_CONFIG` assertions without weakening them.

- [ ] **Step 5: Commit config cutover**

Run:

```bash
git add src/config.ts config/config.yml.template tests/config.test.ts tests/integration/bootstrap.test.ts
git commit -m "feat: enable hindsight memory backend"
```

---

## Phase 5: Doctor and verify integration

### Task 7: Add read-only Hindsight doctor and deterministic verify checks

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`
- Modify: `src/hindsight-service.ts`
- Modify: `tests/hindsight-service.test.ts`

- [ ] **Step 1: Add pure summary tests**

In `tests/hindsight-service.test.ts`, add tests for summary rendering that do not hit real services:

```ts
describe("Hindsight summaries", () => {
	test("renders status lines with config target, auth, health, and UI", () => {
		const lines = renderStatusLines({
			apiPlistPresent: true,
			controlPlanePlistPresent: true,
			codex: { state: "ready", detail: "Codex auth file present at ~/.codex/auth.json" },
			apiHealth: { state: "reachable", detail: "HTTP 204" },
			controlPlaneHealth: { state: "reachable", detail: "HTTP 200" },
		});
		expect(lines).toContain("  ok   OMP managed config target: memory.backend=hindsight");
		expect(lines).toContain("  ok   Hindsight API: reachable (HTTP 204) at http://127.0.0.1:8888");
		expect(lines).toContain("  ok   Hindsight Control Plane: reachable (HTTP 200) at http://127.0.0.1:9999");
	});
});
```

- [ ] **Step 2: Implement pure status line rendering**

Add `renderStatusLines(status)` to `src/hindsight-service.ts`. It should produce stable lines prefixed with `ok`, `WARN`, or `MISS`, include `memory.backend=hindsight`, include both plist presence states, include Codex auth state, and include API/UI health. It must not print auth file contents or environment secrets.

- [ ] **Step 3: Wire doctor and verify**

In `src/cli.ts`:

- Import `createRealHindsightRuntime` from `src/hindsight-service-runtime.ts` and `renderStatusLines` from `src/hindsight-service.ts`.
- In `cmdDoctor`, after Zed checks, call the runtime `status()` and print a `==> Hindsight` section. Increment issue count for missing Codex auth, missing API plist, missing control-plane plist, or unreachable API. Treat unreachable control plane as a warning issue because it is managed, but OMP memory only depends on the API.
- In `cmdVerify`, add deterministic checks that render both plists using fake absolute paths and assert the localhost/provider strings are present. If `OMP_VERIFY_HINDSIGHT_LIVE=1`, call runtime `status()` and require API reachable; do not do retain/recall.

- [ ] **Step 4: Run focused tests and a skip-acceptance verify**

Run:

```bash
bun test tests/hindsight-service.test.ts tests/cli.test.ts
OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify
```

Expected: tests pass. Verify should not attempt a retain/recall model roundtrip and should only perform the existing OMP smokes plus deterministic Hindsight rendering checks.

- [ ] **Step 5: Commit doctor and verify integration**

Run:

```bash
git add src/cli.ts src/hindsight-service.ts tests/cli.test.ts tests/hindsight-service.test.ts
git commit -m "feat: report hindsight readiness"
```

---

## Phase 6: Documentation

### Task 8: Update operator-facing docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update README requirements and commands**

In `README.md`, add requirements bullets under the existing requirements list:

```md
- `codex` CLI logged in with ChatGPT subscription auth (`codex login`) for local Hindsight memory
- `uv` for the persistent `hindsight-api` tool install
- `pnpm` for the pinned Hindsight Control Plane `dlx` runner
```

Add Hindsight scripts to the command table:

```md
| `bun run hindsight:install` | Install/preflight local Hindsight API + Control Plane LaunchAgents, then start and health-check them. |
| `bun run hindsight:{start,stop,restart,status,logs,ui}` | Operate the managed localhost Hindsight services. |
```

Add a short `## Hindsight memory` section after Commands:

```md
## Hindsight memory

Managed OMP config uses `memory.backend: "hindsight"`. The local managed API binds to `127.0.0.1:8888` and uses Hindsight's `openai-codex` provider so memory work uses Codex/ChatGPT subscription auth instead of an OpenAI Platform API key. Run `codex login` first; `~/.codex/auth.json` is a secret and is never copied into this repo.

`bun run hindsight:install` manages two per-user LaunchAgents: `io.glockyco.omp.hindsight` for the API and `io.glockyco.omp.hindsight-control-plane` for the UI at `http://127.0.0.1:9999`. OMP memory depends only on the API. Docker remains an unmanaged fallback for manual experiments.
```

- [ ] **Step 2: Update AGENTS operational boundaries**

In `AGENTS.md`, add command rows for the Hindsight scripts and boundary rows:

```md
| `bun run hindsight:install` | Install/preflight local Hindsight API + Control Plane LaunchAgents, then start and health-check them. |
| `bun run hindsight:{start,stop,restart,status,logs,ui}` | Operate the managed localhost Hindsight services. |
```

Add boundary guidance:

```md
| Hand-edit `~/.omp/agent/config.yml` to toggle memory | Change `src/config.ts` / `config/config.yml.template`, then `bun run bootstrap`. |
| Hand-edit `~/Library/LaunchAgents/io.glockyco.omp.hindsight*.plist` | Change `src/hindsight-service.ts` / `src/hindsight-service-runtime.ts`, then `bun run hindsight:install`. |
| Copy `~/.codex/auth.json` into repo docs, logs, or tests | Treat it as a password; only check for its existence. |
```

Add a concise Hindsight section:

```md
## Hindsight memory

This repo manages OMP memory through local Hindsight. `memory.backend` is `hindsight`; the API is expected at `http://127.0.0.1:8888` and must bind to localhost. The managed Control Plane runs at `http://127.0.0.1:9999` for inspection, but OMP only depends on the API.

Default LLM provider is `openai-codex`, backed by `codex login` subscription auth. Never commit or print `~/.codex/auth.json`; commands only check that it exists. Diagnose with `bun run hindsight:status` and `bun run doctor`.
```

- [ ] **Step 3: Run docs-adjacent checks**

Run:

```bash
bun test tests/config.test.ts tests/cli.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add README.md AGENTS.md
git commit -m "docs: document hindsight memory operations"
```

---

## Phase 7: End-to-end verification and local rollout

### Task 9: Run focused automated gates

**Files:**
- No source edits expected unless a gate reveals a source bug.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun test tests/hindsight-service.test.ts tests/hindsight-service-runtime.test.ts tests/config.test.ts tests/cli.test.ts tests/integration/bootstrap.test.ts
```

Expected: pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
bun run check:types
```

Expected: pass.

- [ ] **Step 3: Run deterministic verify without the model-heavy acceptance smoke**

Run:

```bash
OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify
```

Expected: pass. It must not execute a Hindsight retain/recall model call.

- [ ] **Step 4: Run full CI if focused gates pass**

Run:

```bash
bun run ci
```

Expected: pass. If acceptance smoke or audit reports unrelated environmental failures, capture the exact failing section and continue fixing only failures caused by this change.

### Task 10: Perform local service rollout on the workstation

**Files:**
- Writes outside repo by design: `~/Library/LaunchAgents/io.glockyco.omp.hindsight*.plist`, `~/.omp/logs/*`, managed `~/.omp/agent/config.yml` through bootstrap.

- [ ] **Step 1: Confirm Codex auth prerequisite without printing secrets**

Run:

```bash
codex --version
python3 - <<'PY'
from pathlib import Path
p = Path.home() / ".codex" / "auth.json"
print("codex auth file present" if p.exists() else "codex auth file missing")
PY
```

Expected: version prints; auth file prints present. If missing, run `codex login` and repeat the existence check. Do not print file contents.

- [ ] **Step 2: Install and start managed services**

Run:

```bash
bun run hindsight:install
```

Expected: output includes `hindsight-api` path, absolute `pnpm` path, pinned control-plane package, both plist paths, both launchctl bootstrap actions, API reachable at `http://127.0.0.1:8888`, and UI reachable at `http://127.0.0.1:9999`.

- [ ] **Step 3: Check status and logs**

Run:

```bash
bun run hindsight:status
bun run hindsight:logs
```

Expected: status reports `memory.backend=hindsight`, Codex auth ready, API reachable, Control Plane reachable, and localhost binding expectation. Logs command prints owned log paths and bounded recent lines only.

- [ ] **Step 4: Deploy managed OMP config**

Run:

```bash
bun run bootstrap
```

Expected: managed `~/.omp/agent/config.yml` has `memory.backend: hindsight`; bootstrap remains idempotent on a second run.

- [ ] **Step 5: Run doctor**

Run:

```bash
bun run doctor
```

Expected: doctor reports managed files healthy and Hindsight/Codex ready. If the Control Plane is down but API is healthy, fix the Control Plane service because this repo manages it by default.

- [ ] **Step 6: Open UI**

Run:

```bash
bun run hindsight:ui
```

Expected: opens `http://127.0.0.1:9999`, or prints that exact URL if the opener fails.

- [ ] **Step 7: Verify OMP sees Hindsight in a fresh session**

Start a fresh OMP session after bootstrap. Verify memory tooling is Hindsight-backed by checking OMP memory instructions and available tools, without forcing a retain/recall call unless explicitly opting into live testing.

Expected: memory backend is Hindsight, and `retain`/`recall`/`reflect` tools are available.

---

## Self-review checklist

- Spec coverage:
  - Managed bare-metal API service: Tasks 1-4, 10.
  - Control Plane managed by default with pinned `pnpm dlx`: Tasks 1, 3, 4, 10.
  - Codex subscription auth and secret handling: Tasks 2, 3, 6, 8, 10.
  - Localhost-only API and UI binding: Tasks 1, 3, 7, 8, 10.
  - `memory.backend=hindsight` cutover without managing top-level `hindsight`: Task 6.
  - Doctor and verify integration without default retain/recall: Task 7.
  - Operator docs and commands: Tasks 5, 8.
- No code writes should touch deployed `~/.omp/agent/` files directly; bootstrap remains the only config deployer.
- No tests require real Codex login, Hindsight network calls, or model/subscription usage by default.
