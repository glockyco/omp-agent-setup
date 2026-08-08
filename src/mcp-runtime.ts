/**
 * Real-IO adapters for the managed MCP server checks in src/mcp.ts.
 *
 * Separated out for the same reason as src/plugins-runtime.ts: the check
 * orchestration is worth testing, and it can only be tested if the network
 * call, the subprocess, and the filesystem probe arrive as parameters. These
 * wrappers are exercised only by a real `bun run doctor`.
 *
 * This file is excluded from coverage reporting on purpose.
 */
import { execFile } from "node:child_process";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
	type McpBinSpec,
	type McpHealth,
	type McpLaunchdServiceSpec,
	type McpProbeSpec,
	type McpServerSpec,
	parseMcpToolResultText,
} from "./mcp.ts";

export interface McpProbeDeps {
	fetch: typeof globalThis.fetch;
	execFile: (command: string, args: readonly string[]) => Promise<{ stdout: string }>;
	pathExists: (path: string) => Promise<boolean>;
}

const execFileAsync = promisify(execFile);

const realMcpProbeDeps: McpProbeDeps = {
	fetch: globalThis.fetch,
	async execFile(command, args) {
		const { stdout } = await execFileAsync(command, [...args], { timeout: 5000 });
		return { stdout };
	},
	async pathExists(path) {
		try {
			await lstat(path);
			return true;
		} catch {
			return false;
		}
	},
};

/**
 * Protocol version the daemon negotiated during testing. Streamable HTTP
 * servers reject an unknown version outright, so this is a compatibility pin
 * rather than a "latest wins" value.
 */
const MCP_PROTOCOL_VERSION = "2025-03-26";

const MCP_HEADERS = {
	"content-type": "application/json",
	accept: "application/json, text/event-stream",
};

/** Doctor must stay responsive, so an unreachable daemon fails fast. */
const PROBE_TIMEOUT_MS = 2000;

export interface McpServerReport {
	name: string;
	bin: McpHealth | null;
	launchdService: McpHealth | null;
	probe: McpHealth | null;
}

/**
 * Run every configured check for one spec. Never throws — a health report that
 * dies on the first unreachable service is useless for diagnosing one. Fields
 * are null when the spec omits that check.
 */
export async function checkMcpServer(
	spec: McpServerSpec,
	home: string,
	deps: McpProbeDeps = realMcpProbeDeps,
): Promise<McpServerReport> {
	return {
		name: spec.name,
		bin: spec.bin ? await checkBin(spec.bin, deps) : null,
		launchdService: spec.launchdService
			? await checkLaunchdService(spec.launchdService, home, deps)
			: null,
		probe: spec.probe ? await checkProbe(spec.probe, deps) : null,
	};
}

async function checkBin(bin: McpBinSpec, deps: McpProbeDeps): Promise<McpHealth> {
	let stdout: string;
	try {
		({ stdout } = await deps.execFile(bin.command, bin.versionArgs));
	} catch {
		// A missing binary, a non-zero exit, and a timeout are the same actionable
		// situation: the pinned version is not usable, so print how to install it.
		return { level: "miss", message: `${bin.command} not installed (${bin.installHint})` };
	}
	const found = stdout.trim();
	if (found === bin.expected) return { level: "ok", message: `${bin.command} ${bin.expected}` };
	return { level: "warn", message: `${bin.command} ${found}, pinned ${bin.expected}` };
}

async function checkLaunchdService(
	service: McpLaunchdServiceSpec,
	home: string,
	deps: McpProbeDeps,
): Promise<McpHealth> {
	const plist = join(home, "Library", "LaunchAgents", `${service.label}.plist`);
	if (await deps.pathExists(plist)) {
		return { level: "ok", message: `service ${service.label} installed` };
	}
	return {
		level: "miss",
		message: `service ${service.label} not installed (${service.installCommand})`,
	};
}

/**
 * Open a session, call the readiness tool, and hand the decoded payload to the
 * spec's interpreter. Every failure mode collapses to a `warn` with a message
 * naming the stage that failed, so the user can tell an unreachable daemon from
 * one that answered with something unexpected.
 */
async function checkProbe(probe: McpProbeSpec, deps: McpProbeDeps): Promise<McpHealth> {
	let sessionId: string | null;
	try {
		const response = await deps.fetch(probe.url, {
			method: "POST",
			headers: MCP_HEADERS,
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: MCP_PROTOCOL_VERSION,
					capabilities: {},
					clientInfo: { name: "omp-doctor", version: "1" },
				},
			}),
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
		if (!response.ok) return { level: "warn", message: `daemon returned HTTP ${response.status}` };
		sessionId = response.headers.get("mcp-session-id");
		// Drain the body so the connection is released before the second call.
		await response.text();
	} catch {
		return { level: "warn", message: `daemon unreachable at ${probe.url}` };
	}
	if (sessionId === null || sessionId === "") {
		return { level: "warn", message: "daemon did not open a session" };
	}

	let body: string;
	try {
		const response = await deps.fetch(probe.url, {
			method: "POST",
			headers: { ...MCP_HEADERS, "mcp-session-id": sessionId },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 2,
				method: "tools/call",
				params: { name: probe.readinessTool, arguments: {} },
			}),
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
		if (!response.ok) {
			return { level: "warn", message: `readiness call returned HTTP ${response.status}` };
		}
		body = await response.text();
	} catch {
		return { level: "warn", message: `daemon unreachable at ${probe.url}` };
	}

	const text = parseMcpToolResultText(body);
	if (text === null) return { level: "warn", message: "unreadable probe response" };
	try {
		return probe.interpret(text);
	} catch {
		return { level: "warn", message: "unreadable probe response" };
	}
}
