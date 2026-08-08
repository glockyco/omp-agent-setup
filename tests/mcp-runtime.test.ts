import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { McpHealth, McpServerSpec } from "../src/mcp.ts";
import { checkMcpServer, type McpProbeDeps } from "../src/mcp-runtime.ts";

const HOME = "/Users/test";
const PROBE_URL = "http://127.0.0.1:3001/mcp";
const PLIST = join(HOME, "Library", "LaunchAgents", "com.example.daemon.plist");

const okStatus: McpHealth = { level: "ok", message: "bridge connected" };

const SPEC: McpServerSpec = {
	name: "example",
	config: { type: "http", url: PROBE_URL },
	bin: {
		command: "example-server",
		versionArgs: ["--version"],
		expected: "1.2.3",
		installHint: "npm i -g example-server@1.2.3",
	},
	launchdService: {
		label: "com.example.daemon",
		installCommand: "example-server daemon install-launchd",
	},
	probe: { url: PROBE_URL, readinessTool: "example_status", interpret: () => okStatus },
};

/** The real wire shape: JSON nested as an escaped string inside an SSE frame. */
const sseBody = (payload: unknown) =>
	`event: message\ndata: ${JSON.stringify({
		result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
		jsonrpc: "2.0",
		id: 2,
	})}\n\n`;

interface FetchCall {
	url: string;
	headers: Record<string, string>;
	body: unknown;
}

interface StubOptions {
	version?: string;
	versionError?: boolean;
	plistExists?: boolean;
	initStatus?: number;
	initSessionId?: string | null;
	readinessStatus?: number;
	readinessBody?: string;
	fetchError?: "initialize" | "readiness";
}

function stubDeps(options: StubOptions = {}): { deps: McpProbeDeps; calls: FetchCall[] } {
	const calls: FetchCall[] = [];
	const deps: McpProbeDeps = {
		async execFile() {
			if (options.versionError) throw new Error("ENOENT");
			return { stdout: `${options.version ?? "1.2.3"}\n` };
		},
		async pathExists(path) {
			return path === PLIST && (options.plistExists ?? true);
		},
		fetch: (async (url: string, init: RequestInit) => {
			const headers = init.headers as Record<string, string>;
			const stage = headers["mcp-session-id"] === undefined ? "initialize" : "readiness";
			calls.push({ url, headers, body: JSON.parse(init.body as string) });
			if (options.fetchError === stage) throw new TypeError("fetch failed");
			if (stage === "initialize") {
				const sessionId = options.initSessionId === undefined ? "sid-1" : options.initSessionId;
				return new Response("", {
					status: options.initStatus ?? 200,
					headers: sessionId === null ? {} : { "mcp-session-id": sessionId },
				});
			}
			return new Response(options.readinessBody ?? sseBody({ connected: true }), {
				status: options.readinessStatus ?? 200,
			});
		}) as unknown as typeof globalThis.fetch,
	};
	return { deps, calls };
}

const check = async (options: StubOptions = {}, spec: McpServerSpec = SPEC) =>
	await checkMcpServer(spec, HOME, stubDeps(options).deps);

describe("checkMcpServer bin check", () => {
	test("reports the pinned version as healthy", async () => {
		expect((await check()).bin).toEqual({ level: "ok", message: "example-server 1.2.3" });
	});

	test("warns when the installed version drifted from the pin", async () => {
		expect((await check({ version: "1.3.0" })).bin).toEqual({
			level: "warn",
			message: "example-server 1.3.0, pinned 1.2.3",
		});
	});

	test("reports a missing binary with the install hint", async () => {
		expect((await check({ versionError: true })).bin).toEqual({
			level: "miss",
			message: "example-server not installed (npm i -g example-server@1.2.3)",
		});
	});
});

describe("checkMcpServer launchd check", () => {
	test("reports an installed service as healthy", async () => {
		expect((await check()).launchdService).toEqual({
			level: "ok",
			message: "service com.example.daemon installed",
		});
	});

	test("reports a missing plist with the install command", async () => {
		expect((await check({ plistExists: false })).launchdService).toEqual({
			level: "miss",
			message: "service com.example.daemon not installed (example-server daemon install-launchd)",
		});
	});
});

describe("checkMcpServer probe", () => {
	test("returns the interpreter's verdict on the happy path", async () => {
		expect((await check()).probe).toEqual(okStatus);
	});

	test("propagates the session id from initialize into the readiness call", async () => {
		const { deps, calls } = stubDeps();
		await checkMcpServer(SPEC, HOME, deps);

		expect(calls).toHaveLength(2);
		expect(calls[0]?.headers["mcp-session-id"]).toBeUndefined();
		expect(calls[1]?.headers["mcp-session-id"]).toBe("sid-1");
		expect(calls[1]?.body).toMatchObject({
			method: "tools/call",
			params: { name: "example_status", arguments: {} },
		});
	});

	test("warns when the daemon refuses the connection", async () => {
		expect((await check({ fetchError: "initialize" })).probe).toEqual({
			level: "warn",
			message: `daemon unreachable at ${PROBE_URL}`,
		});
	});

	test("warns when the readiness call itself fails to connect", async () => {
		expect((await check({ fetchError: "readiness" })).probe).toEqual({
			level: "warn",
			message: `daemon unreachable at ${PROBE_URL}`,
		});
	});

	test("warns on a non-2xx initialize response", async () => {
		expect((await check({ initStatus: 503 })).probe).toEqual({
			level: "warn",
			message: "daemon returned HTTP 503",
		});
	});

	test("warns when no session header comes back", async () => {
		expect((await check({ initSessionId: null })).probe).toEqual({
			level: "warn",
			message: "daemon did not open a session",
		});
	});

	test("warns when the session header is empty", async () => {
		expect((await check({ initSessionId: "" })).probe).toEqual({
			level: "warn",
			message: "daemon did not open a session",
		});
	});

	test("warns on a non-2xx readiness response", async () => {
		expect((await check({ readinessStatus: 500 })).probe).toEqual({
			level: "warn",
			message: "readiness call returned HTTP 500",
		});
	});

	test("warns when the readiness body cannot be decoded", async () => {
		expect((await check({ readinessBody: "garbage" })).probe).toEqual({
			level: "warn",
			message: "unreadable probe response",
		});
	});

	test("warns instead of propagating when the interpreter throws", async () => {
		const throwing: McpServerSpec = {
			...SPEC,
			probe: {
				url: PROBE_URL,
				readinessTool: "example_status",
				interpret: () => {
					throw new Error("boom");
				},
			},
		};
		expect((await check({}, throwing)).probe).toEqual({
			level: "warn",
			message: "unreadable probe response",
		});
	});
});

describe("checkMcpServer optional checks", () => {
	test("returns null for every check the spec omits", async () => {
		const bare: McpServerSpec = { name: "bare", config: { type: "http", url: PROBE_URL } };
		expect(await check({}, bare)).toEqual({
			name: "bare",
			bin: null,
			launchdService: null,
			probe: null,
		});
	});
});
