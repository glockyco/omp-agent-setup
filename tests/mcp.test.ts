import { describe, expect, test } from "bun:test";
import {
	interpretRemnoteStatus,
	isParsableMcpJson,
	MANAGED_MCP_SERVERS,
	MCP_SCHEMA_URL,
	type McpServerSpec,
	managedMcpServerConfigs,
	mergeManagedMcpConfig,
	parseMcpToolResultText,
	readMcpServer,
} from "../src/mcp.ts";

const REMNOTE_CONFIG = { type: "http", url: "http://127.0.0.1:3001/mcp", timeout: 5000 };

const USER_MCP = `${JSON.stringify(
	{
		$schema: "https://example.invalid/other-schema.json",
		mcpServers: { github: { type: "http", url: "https://api.githubcopilot.com/mcp/" } },
		disabledServers: ["slack"],
	},
	null,
	2,
)}\n`;

/** Build the wire shape the daemon actually returns: JSON nested inside an SSE frame. */
const sse = (payload: unknown) =>
	`event: message\ndata: ${JSON.stringify({
		result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
		jsonrpc: "2.0",
		id: 2,
	})}\n\n`;

const parsed = (json: string) => JSON.parse(json) as Record<string, unknown>;

describe("MANAGED_MCP_SERVERS", () => {
	test("pins remnote to the measured local endpoint and timeout", () => {
		const remnote = MANAGED_MCP_SERVERS.find(spec => spec.name === "remnote");
		expect(remnote?.config).toEqual(REMNOTE_CONFIG);
	});

	test("keeps the probe URL and the deployed config URL in agreement", () => {
		for (const spec of MANAGED_MCP_SERVERS) {
			if (spec.probe) expect(spec.config.url).toBe(spec.probe.url);
		}
	});
});

describe("managedMcpServerConfigs", () => {
	test("maps each spec name to its config", () => {
		expect(managedMcpServerConfigs()).toEqual({ remnote: REMNOTE_CONFIG });
	});
});

describe("mergeManagedMcpConfig", () => {
	test("adds the managed server entry verbatim", () => {
		expect(readMcpServer(mergeManagedMcpConfig(USER_MCP), "remnote")).toEqual(REMNOTE_CONFIG);
	});

	test("leaves a rival server entry untouched", () => {
		expect(readMcpServer(mergeManagedMcpConfig(USER_MCP), "github")).toEqual({
			type: "http",
			url: "https://api.githubcopilot.com/mcp/",
		});
	});

	test("preserves unrelated top-level keys", () => {
		expect(parsed(mergeManagedMcpConfig(USER_MCP)).disabledServers).toEqual(["slack"]);
	});

	test("leaves a user-chosen $schema alone", () => {
		expect(parsed(mergeManagedMcpConfig(USER_MCP)).$schema).toBe(
			"https://example.invalid/other-schema.json",
		);
	});

	test("injects $schema when absent", () => {
		expect(parsed(mergeManagedMcpConfig('{"mcpServers":{}}')).$schema).toBe(MCP_SCHEMA_URL);
	});

	test("injects $schema when present but empty", () => {
		expect(parsed(mergeManagedMcpConfig('{"$schema":""}')).$schema).toBe(MCP_SCHEMA_URL);
	});

	test("treats empty input as a fresh document", () => {
		expect(parsed(mergeManagedMcpConfig(""))).toEqual({
			$schema: MCP_SCHEMA_URL,
			mcpServers: { remnote: REMNOTE_CONFIG },
		});
	});

	test("treats whitespace-only input as a fresh document", () => {
		expect(mergeManagedMcpConfig("   \n")).toBe(mergeManagedMcpConfig(""));
	});

	test("is idempotent", () => {
		const once = mergeManagedMcpConfig(USER_MCP);
		expect(mergeManagedMcpConfig(once)).toBe(once);
	});

	test("ends with a trailing newline", () => {
		expect(mergeManagedMcpConfig(USER_MCP).endsWith("}\n")).toBe(true);
	});

	test("accepts a narrower server list", () => {
		const other: McpServerSpec = { name: "other", config: { type: "http", url: "http://x/" } };
		const merged = mergeManagedMcpConfig("", [other]);
		expect(readMcpServer(merged, "other")).toEqual({ type: "http", url: "http://x/" });
		expect(readMcpServer(merged, "remnote")).toBeUndefined();
	});

	test.each([
		["{", /not valid JSON/],
		["null", /JSON object at the top level/],
		["[]", /JSON object at the top level/],
		['"str"', /JSON object at the top level/],
		["42", /JSON object at the top level/],
		['{"mcpServers":[]}', /"mcpServers" must be an object/],
		['{"mcpServers":null}', /"mcpServers" must be an object/],
	])("refuses to overwrite malformed input %p", (input, message) => {
		expect(() => mergeManagedMcpConfig(input)).toThrow(message);
	});
});

describe("readMcpServer", () => {
	test.each([
		"",
		"   ",
		"{",
		"null",
		"[]",
		'"str"',
		"42",
		'{"mcpServers":[]}',
		'{"mcpServers":null}',
	])("returns undefined instead of throwing for %p", input => {
		expect(readMcpServer(input, "remnote")).toBeUndefined();
	});

	test("returns undefined for an absent entry in a valid document", () => {
		expect(readMcpServer(USER_MCP, "remnote")).toBeUndefined();
	});
});

describe("isParsableMcpJson", () => {
	test.each(["", "   ", "{}", USER_MCP])("accepts %p", input => {
		expect(isParsableMcpJson(input)).toBe(true);
	});

	test("rejects a truncated document", () => {
		expect(isParsableMcpJson("{")).toBe(false);
	});
});

describe("parseMcpToolResultText", () => {
	test("unwraps the escaped payload nested inside the SSE frame", () => {
		expect(parseMcpToolResultText(sse({ connected: true }))).toBe('{"connected":true}');
	});

	test("returns null when there is no data line", () => {
		expect(parseMcpToolResultText("garbage")).toBeNull();
	});

	test("returns null for a JSON-RPC error envelope", () => {
		const frame = `data: ${JSON.stringify({
			jsonrpc: "2.0",
			id: 2,
			error: { code: -32601, message: "Method not found" },
		})}\n\n`;
		expect(parseMcpToolResultText(frame)).toBeNull();
	});

	test("returns null when the data line is not JSON", () => {
		expect(parseMcpToolResultText("data: not-json\n\n")).toBeNull();
	});

	test("returns null for an empty content array", () => {
		expect(
			parseMcpToolResultText(`data: ${JSON.stringify({ result: { content: [] } })}\n\n`),
		).toBeNull();
	});

	test("returns null when the payload is not a string", () => {
		const frame = `data: ${JSON.stringify({ result: { content: [{ type: "text", text: 42 }] } })}\n\n`;
		expect(parseMcpToolResultText(frame)).toBeNull();
	});
});

describe("interpretRemnoteStatus", () => {
	test("reports a connected bridge as healthy", () => {
		const text = parseMcpToolResultText(sse({ connected: true, serverVersion: "0.17.0" }));
		expect(interpretRemnoteStatus(text ?? "")).toEqual({ level: "ok", message: "bridge connected" });
	});

	test("treats a closed RemNote.app as a note, not a failure", () => {
		const text = parseMcpToolResultText(
			sse({ connected: false, serverVersion: "0.17.0", message: "RemNote plugin not connected" }),
		);
		expect(interpretRemnoteStatus(text ?? "")).toEqual({
			level: "note",
			message: "daemon up, RemNote.app not connected",
		});
	});

	test("warns on a payload that is not JSON", () => {
		expect(interpretRemnoteStatus("garbage").level).toBe("warn");
	});

	test("warns on a payload that is JSON but not an object", () => {
		expect(interpretRemnoteStatus("[1,2]").level).toBe("warn");
	});
});
