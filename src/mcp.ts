import { isDeepStrictEqual } from "node:util";

/**
 * Display severity for one health check. `warn` and `miss` count as doctor
 * issues; `ok` and `note` do not.
 */
type McpHealthLevel = "ok" | "note" | "warn" | "miss";

export interface McpHealth {
	level: McpHealthLevel;
	message: string;
}

/**
 * Readiness probe. Assumes Streamable HTTP and a zero-argument readiness tool.
 */
interface McpProbeSpec {
	url: string;
	readinessTool: string;
	/**
	 * Maps the readiness tool's decoded text payload to a health result. Must
	 * not throw; callers catch defensively anyway.
	 */
	interpret: (resultText: string) => McpHealth;
}

interface McpBinSpec {
	command: string;
	versionArgs: string[];
	expected: string;
	installHint: string;
}

/**
 * macOS launchd agent this server depends on. Named for the mechanism, not
 * generalized: the check is a plist existence test under `~/Library/LaunchAgents`.
 */
interface McpLaunchdServiceSpec {
	label: string;
	installCommand: string;
}

export interface McpServerSpec {
	name: string;
	/** Written verbatim as `mcpServers[name]`. Not validated against OMP's schema. */
	config: Record<string, unknown>;
	bin?: McpBinSpec;
	launchdService?: McpLaunchdServiceSpec;
	probe?: McpProbeSpec;
}

export const MCP_SCHEMA_URL =
	"https://raw.githubusercontent.com/can1357/oh-my-pi/main/packages/coding-agent/src/config/mcp-schema.json";

const REMNOTE_MCP_URL = "http://127.0.0.1:3001/mcp";
const REMNOTE_SERVER_VERSION = "0.17.0";

/**
 * MCP servers this repository deploys into `~/.omp/agent/mcp.json`.
 *
 * Scope is deliberately narrow: every entry must be **Streamable HTTP,
 * unauthenticated, with readiness determined by calling a zero-argument tool**.
 * A stdio or SSE server, one needing auth headers or initialization
 * capabilities, or one whose readiness is not a tool call needs new runtime
 * code, not just a registry entry. Adding a transport abstraction before a
 * second transport exists would be guessing at its shape.
 *
 * Pins live here rather than in a `manifests/*.yml` because a spec carries an
 * `interpret` function that cannot be expressed in YAML, and splitting half a
 * spec across two formats is worse than one typed registry.
 */
export const MANAGED_MCP_SERVERS: readonly McpServerSpec[] = [
	{
		name: "remnote",
		// `timeout` is measured, not guessed. OMP waits out the configured MCP
		// timeout during process teardown at roughly 0.65x its value, so the cost
		// lands on every session exit whether or not a tool was ever called.
		// 60000 produced a 52s one-shot run whose useful output finished at 12.8s;
		// 5000 produced 13s total with output at 10.3s. Per-call transport latency
		// is ~1.5ms, so a larger value buys nothing during work. Do not raise
		// without re-measuring the exit cost.
		config: { type: "http", url: REMNOTE_MCP_URL, timeout: 5000 },
		bin: {
			command: "remnote-mcp-server",
			versionArgs: ["--version"],
			expected: REMNOTE_SERVER_VERSION,
			installHint: `npm i -g remnote-mcp-server@${REMNOTE_SERVER_VERSION}`,
		},
		launchdService: {
			label: "com.remnote.mcp-server",
			installCommand: "remnote-mcp-server daemon install-launchd",
		},
		probe: {
			url: REMNOTE_MCP_URL,
			readinessTool: "remnote_status",
			interpret: interpretRemnoteStatus,
		},
	},
];

/**
 * Servers this repo used to manage. An entry is removed from a user's mcp.json
 * only while its value still deep-equals what we wrote. Empty today.
 */
const FORMER_MANAGED_MCP_SERVERS: Record<string, unknown> = {};

/**
 * Turn the RemNote daemon's status payload into a health result.
 *
 * `note` rather than `warn` for a disconnected bridge is deliberate. The daemon
 * reaches the knowledge base through a plugin inside RemNote.app, so a closed
 * app is a normal daily state, not a broken install. A health report that turns
 * red whenever the user quits an app is a health report the user learns to
 * ignore.
 */
export function interpretRemnoteStatus(resultText: string): McpHealth {
	let parsed: unknown;
	try {
		parsed = JSON.parse(resultText);
	} catch {
		return { level: "warn", message: "unreadable status payload" };
	}
	// An array or scalar is a syntactically valid JSON value but not a status
	// object, so it is unreadable rather than merely disconnected.
	if (!isJsonObject(parsed)) {
		return { level: "warn", message: "unreadable status payload" };
	}
	if (parsed.connected === true) {
		return { level: "ok", message: "bridge connected" };
	}
	return { level: "note", message: "daemon up, RemNote.app not connected" };
}

/**
 * Pull the tool result text out of a Streamable HTTP response body.
 *
 * The payload is nested twice: an SSE frame carries a JSON-RPC envelope, whose
 * `result.content[0].text` is itself a JSON string. A substring search for the
 * inner fields against the raw body never matches, because the inner JSON
 * arrives escaped.
 *
 * Returns `null` — never throws — for a missing data line, a parse failure, a
 * JSON-RPC error envelope, an empty content array, or a non-string payload.
 */
export function parseMcpToolResultText(sse: string): string | null {
	const line = sse.split("\n").find(candidate => candidate.startsWith("data: "));
	if (line === undefined) return null;
	let frame: unknown;
	try {
		frame = JSON.parse(line.slice("data: ".length));
	} catch {
		return null;
	}
	if (!isJsonObject(frame)) return null;
	const result = frame.result;
	if (!isJsonObject(result)) return null;
	const content = result.content;
	if (!Array.isArray(content) || content.length === 0) return null;
	const first: unknown = content[0];
	if (!isJsonObject(first)) return null;
	return typeof first.text === "string" ? first.text : null;
}

/**
 * True when `text` can be read as JSON at all. An empty file counts as
 * parsable: `mcp.json` may simply not exist yet, which is not a syntax error.
 * Doctor uses this to tell "the file is malformed" apart from "the managed
 * entry drifted", which need different remedies.
 */
export function isParsableMcpJson(text: string): boolean {
	if (text.trim() === "") return true;
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read one entry out of `mcpServers`, or `undefined` when it is absent or the
 * document is unusable. Never throws: doctor reports on malformed files rather
 * than dying on them.
 */
export function readMcpServer(json: string, name: string): unknown {
	if (json.trim() === "") return undefined;
	let doc: unknown;
	try {
		doc = JSON.parse(json);
	} catch {
		return undefined;
	}
	if (!isJsonObject(doc)) return undefined;
	const servers = doc.mcpServers;
	if (!isJsonObject(servers)) return undefined;
	return servers[name];
}

/** Map each managed spec's name to the config value written into `mcpServers`. */
export function managedMcpServerConfigs(
	servers: readonly McpServerSpec[] = MANAGED_MCP_SERVERS,
): Record<string, unknown> {
	const configs: Record<string, unknown> = {};
	for (const spec of servers) {
		configs[spec.name] = spec.config;
	}
	return configs;
}

/**
 * Merge the managed servers into the user's `mcp.json` and return the new text.
 *
 * Merged rather than symlinked, unlike `agent/lsp.json`. OMP writes this file
 * itself — `/mcp add`, `/mcp enable`, `/mcp disable`, `/mcp reauth`, and its
 * automatic `$schema` injection all target `~/.omp/agent/mcp.json`. Linking it
 * into the repo would turn every `/mcp disable` into permanent working-tree
 * dirt. `lsp.json` is safe to symlink precisely because OMP never writes it.
 *
 * Behavior contract:
 * - Empty input is treated as `{}`; bootstrap passes `""` for a missing file.
 * - Every malformed shape throws with an actionable message. A user's file is
 *   never silently discarded or overwritten with a fresh document.
 * - `$schema` is set only when absent or empty, so a user-chosen value stands.
 * - A former managed server is deleted only while its value still deep-equals
 *   what this repo wrote, matching `FORMER_MANAGED_CONFIG` in `config.ts`.
 * - Every other top-level key, notably `disabledServers`, and every unmanaged
 *   entry inside `mcpServers`, is preserved verbatim.
 */
export function mergeManagedMcpConfig(
	existingJson: string,
	servers: readonly McpServerSpec[] = MANAGED_MCP_SERVERS,
): string {
	let doc: Record<string, unknown> = {};
	if (existingJson.trim() !== "") {
		let parsed: unknown;
		try {
			parsed = JSON.parse(existingJson);
		} catch {
			throw new Error("mcp.json is not valid JSON; fix or delete it, then re-run bootstrap");
		}
		if (!isJsonObject(parsed)) {
			throw new Error(
				"mcp.json must contain a JSON object at the top level; fix or delete it, then re-run bootstrap",
			);
		}
		doc = parsed;
	}

	const existingServers = doc.mcpServers;
	if (existingServers !== undefined && !isJsonObject(existingServers)) {
		throw new Error(
			'mcp.json "mcpServers" must be an object; fix or delete it, then re-run bootstrap',
		);
	}
	const mcpServers: Record<string, unknown> = existingServers ?? {};

	if (doc.$schema === undefined || doc.$schema === "") {
		doc.$schema = MCP_SCHEMA_URL;
	}
	for (const [name, formerConfig] of Object.entries(FORMER_MANAGED_MCP_SERVERS)) {
		if (servers.some(spec => spec.name === name)) continue;
		if (isDeepStrictEqual(mcpServers[name], formerConfig)) delete mcpServers[name];
	}
	Object.assign(mcpServers, managedMcpServerConfigs(servers));
	doc.mcpServers = mcpServers;

	return `${JSON.stringify(doc, null, 2)}\n`;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
