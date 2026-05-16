import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildManagedZedSettings,
	MANAGED_ZED_KEYS,
	mergeManagedZedSettings,
	readZedAgentServer,
	ZedSettingsParseError,
} from "../src/zed-settings.ts";
import { applyManagedZedSettings, zedSettingsPath } from "../src/zed-settings-runtime.ts";

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

	test("accepts trailing commas and comments (Zed JSONC dialect)", () => {
		const withTrailingCommas = `// hello
{
  "theme": {
    "mode": "system",
    "light": "One Light",
    "dark": "One Dark",
  },
  "languages": {
    "CSharp": { "language_servers": ["omnisharp", "!roslyn"], },
  },
}
`;
		const out = mergeManagedZedSettings(withTrailingCommas, canonical());
		expect(out).toContain("// hello");
		expect(out).toContain('"omnisharp"');
		expect(readZedAgentServer(out, "omp-acp")).toEqual(canonical().agent_servers["omp-acp"]);
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

let runtimeHome: string;

beforeEach(async () => {
	runtimeHome = await mkdtemp(join(tmpdir(), "omp-zed-rt-"));
});

afterEach(async () => {
	await rm(runtimeHome, { recursive: true, force: true });
});

describe("zedSettingsPath", () => {
	test("resolves under ~/.config/zed/settings.json", () => {
		expect(zedSettingsPath(runtimeHome)).toBe(join(runtimeHome, ".config", "zed", "settings.json"));
	});
});

describe("applyManagedZedSettings", () => {
	test("seeds a missing file with the managed omp-acp entry", async () => {
		const result = await applyManagedZedSettings({
			path: zedSettingsPath(runtimeHome),
			ompPath: "/fake/omp",
		});
		expect(result.existed).toBe(false);
		expect(result.changed).toBe(true);
		const text = await readFile(result.path, "utf8");
		expect(readZedAgentServer(text, "omp-acp")).toEqual({
			type: "custom",
			command: "/fake/omp",
			args: ["acp"],
		});
	});

	test("preserves unrelated keys and is idempotent", async () => {
		const target = zedSettingsPath(runtimeHome);
		await mkdir(join(runtimeHome, ".config", "zed"), { recursive: true });
		await writeFile(target, `// keep me\n{ "vim_mode": true }\n`);
		const first = await applyManagedZedSettings({ path: target, ompPath: "/fake/omp" });
		expect(first.changed).toBe(true);
		expect(await readFile(target, "utf8")).toContain("// keep me");
		const second = await applyManagedZedSettings({ path: target, ompPath: "/fake/omp" });
		expect(second.changed).toBe(false);
	});

	test("throws ZedSettingsParseError on malformed user input", async () => {
		const target = zedSettingsPath(runtimeHome);
		await mkdir(join(runtimeHome, ".config", "zed"), { recursive: true });
		await writeFile(target, `{ "agent_servers": { broken`);
		await expect(applyManagedZedSettings({ path: target, ompPath: "/fake/omp" })).rejects.toThrow(
			ZedSettingsParseError,
		);
	});
});
