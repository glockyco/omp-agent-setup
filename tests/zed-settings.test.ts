import { describe, expect, test } from "bun:test";
import {
	buildManagedZedSettings,
	MANAGED_ZED_KEYS,
	mergeManagedZedSettings,
	readZedAgentServer,
	ZedSettingsParseError,
} from "../src/zed-settings.ts";

const FAKE_OMP = "/fake/path/to/omp";

const canonical = (ompPath = FAKE_OMP) => buildManagedZedSettings({ ompPath });

const sampleSettings = `// Zed settings
{
  "agent_servers": {
    "claude-acp": { "type": "registry" }
  },
  "vim_mode": true
}
`;

describe("MANAGED_ZED_KEYS", () => {
	test("owns only agent_servers today", () => {
		expect(MANAGED_ZED_KEYS).toEqual(["agent_servers"]);
	});
});

describe("buildManagedZedSettings", () => {
	test("produces omp-acp custom entry pointing at the resolved binary", () => {
		expect(canonical("/abs/omp").agent_servers["omp-acp"]).toEqual({
			type: "custom",
			command: "/abs/omp",
			args: ["acp"],
		});
	});
});

describe("mergeManagedZedSettings", () => {
	test("adds omp-acp without touching claude-acp or unrelated keys", () => {
		const out = mergeManagedZedSettings(sampleSettings, canonical());
		expect(readZedAgentServer(out, "claude-acp")).toEqual({ type: "registry" });
		expect(readZedAgentServer(out, "omp-acp")).toEqual(canonical().agent_servers["omp-acp"]);
		expect(out).toContain("// Zed settings");
		expect(out).toContain('"vim_mode": true');
	});

	test("is byte-for-byte idempotent", () => {
		const once = mergeManagedZedSettings(sampleSettings, canonical());
		const twice = mergeManagedZedSettings(once, canonical());
		expect(twice).toBe(once);
	});

	test("overwrites a stale omp-acp entry to canonical shape", () => {
		const stale = `{
  "agent_servers": {
    "omp-acp": { "type": "custom", "command": "old-omp", "args": ["acp", "--bad"] }
  }
}
`;
		const out = mergeManagedZedSettings(stale, canonical());
		expect(readZedAgentServer(out, "omp-acp")).toEqual(canonical().agent_servers["omp-acp"]);
	});

	test("seeds an empty file with a valid managed document", () => {
		const out = mergeManagedZedSettings("", canonical());
		expect(readZedAgentServer(out, "omp-acp")).toEqual(canonical().agent_servers["omp-acp"]);
	});

	test("does not touch languages.CSharp (left to user)", () => {
		const withCsharpOverride = `{
  "languages": { "CSharp": { "language_servers": ["omnisharp", "!roslyn"] } }
}
`;
		const out = mergeManagedZedSettings(withCsharpOverride, canonical());
		expect(out).toContain('"omnisharp"');
		expect(out).toContain('"!roslyn"');
	});

	test("throws ZedSettingsParseError on syntactically invalid JSONC", () => {
		const broken = `{ "agent_servers": { "claude-acp": { type: "registry" } }`;
		expect(() => mergeManagedZedSettings(broken, canonical())).toThrow(ZedSettingsParseError);
	});
});

describe("readZedAgentServer", () => {
	test("returns undefined when entry is absent", () => {
		expect(readZedAgentServer(`{}`, "omp-acp")).toBeUndefined();
	});

	test("throws ZedSettingsParseError on invalid JSONC", () => {
		expect(() => readZedAgentServer(`{ broken`, "omp-acp")).toThrow(ZedSettingsParseError);
	});
});
