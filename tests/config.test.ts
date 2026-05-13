import { describe, expect, test } from "bun:test";
import { parseDocument } from "yaml";
import { MANAGED_CONFIG, MANAGED_KEYS, mergeManagedConfig, readTopLevel } from "../src/config.ts";

const USER_CONFIG = `lastChangelogVersion: 15.0.0
modelRoles:
  default: openai-codex/gpt-5.5
  task: gpt-5.5
extensions:
  - ~/old/path
steeringMode: all
edit:
  mode: hashline
defaultThinkingLevel: high
`;

describe("mergeManagedConfig", () => {
	test("replaces managed extensions in place", () => {
		const merged = mergeManagedConfig(USER_CONFIG);
		expect(readTopLevel(merged, "extensions")).toEqual([
			"~/Projects/plannotator/apps/pi-extension",
			"~/.omp/agent/extensions/superpowers-bootstrap.ts",
		]);
	});

	test("preserves unrelated top-level keys", () => {
		const merged = mergeManagedConfig(USER_CONFIG);
		expect(readTopLevel(merged, "lastChangelogVersion")).toBe("15.0.0");
		expect(readTopLevel(merged, "modelRoles")).toEqual({
			default: "openai-codex/gpt-5.5",
			task: "gpt-5.5",
		});
		expect(readTopLevel(merged, "steeringMode")).toBe("all");
		expect(readTopLevel(merged, "edit")).toEqual({ mode: "hashline" });
		expect(readTopLevel(merged, "defaultThinkingLevel")).toBe("high");
	});

	test("appends missing managed keys", () => {
		const merged = mergeManagedConfig(USER_CONFIG);
		expect(readTopLevel(merged, "skills")).toEqual({
			customDirectories: [
				"~/Projects/superpowers/skills",
				"~/Projects/plannotator/apps/pi-extension/skills",
			],
		});
		expect(readTopLevel(merged, "compaction")).toMatchObject({
			strategy: "handoff",
			thresholdPercent: 80,
			thresholdTokens: -1,
			enabled: true,
		});
		expect(readTopLevel(merged, "memory")).toEqual({ backend: "off" });
	});

	test("is idempotent when applied twice", () => {
		const first = mergeManagedConfig(USER_CONFIG);
		const second = mergeManagedConfig(first);
		expect(second).toBe(first);
	});

	test("works on an empty document", () => {
		const merged = mergeManagedConfig("");
		for (const key of MANAGED_KEYS) {
			expect(readTopLevel(merged, key)).toEqual(MANAGED_CONFIG[key] as unknown);
		}
	});

	test("works on a document containing only comments", () => {
		const merged = mergeManagedConfig("# leading comment only\n");
		for (const key of MANAGED_KEYS) {
			expect(readTopLevel(merged, key)).toEqual(MANAGED_CONFIG[key] as unknown);
		}
	});

	test("does not introduce duplicate top-level keys", () => {
		const merged = mergeManagedConfig(USER_CONFIG);
		const doc = parseDocument(merged);
		const items = doc.contents && "items" in doc.contents ? doc.contents.items : [];
		const seen = new Set<string>();
		for (const item of items as Array<{ key: { value: string } }>) {
			const name = item.key.value;
			expect(seen.has(name)).toBe(false);
			seen.add(name);
		}
	});

	test("accepts a custom managed override", () => {
		const merged = mergeManagedConfig(USER_CONFIG, {
			extensions: ["~/only/this"],
		});
		expect(readTopLevel(merged, "extensions")).toEqual(["~/only/this"]);
		// untouched managed keys from the default set should NOT appear because
		// caller chose a narrower override
		expect(readTopLevel(merged, "memory")).toBeUndefined();
	});
});
