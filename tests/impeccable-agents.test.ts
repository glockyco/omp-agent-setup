import { describe, expect, test } from "bun:test";
import { translateClaudeAgent } from "../src/impeccable-agents.ts";

const CLAUDE_SOURCE = [
	"---",
	"name: impeccable-finish-reviewer",
	"description: Reviews a finished Impeccable build.",
	"tools: Read, Bash, Glob, Grep",
	"model: inherit",
	"effort: high",
	"maxTurns: 30",
	"---",
	"# Impeccable Finish Reviewer",
	"",
	"Body text.",
].join("\n");

const FILE = "impeccable-finish-reviewer.md";

describe("translateClaudeAgent", () => {
	test("rewrites the front-matter into OMP's agent schema", () => {
		const output = translateClaudeAgent(CLAUDE_SOURCE, FILE);

		expect(output).toContain("name: impeccable-finish-reviewer");
		expect(output).toContain('description: "Reviews a finished Impeccable build."');
		expect(output).toContain("tools: read, bash, glob, grep, yield");
		expect(output).toContain("thinkingLevel: high");
	});

	test("drops the keys OMP has no equivalent for", () => {
		const output = translateClaudeAgent(CLAUDE_SOURCE, FILE);

		// `model: inherit` has no OMP sentinel; omitting the key is what leaves
		// resolution to the session. `maxTurns` has no OMP equivalent at all.
		expect(output).not.toContain("model:");
		expect(output).not.toContain("maxTurns");
		expect(output).not.toContain("effort:");
	});

	test("emits no output block", () => {
		// A schema here collapses the reviewer's prose into an empty envelope.
		expect(translateClaudeAgent(CLAUDE_SOURCE, FILE)).not.toContain("output:");
	});

	test("copies the body verbatim after the closing delimiter", () => {
		const output = translateClaudeAgent(CLAUDE_SOURCE, FILE);
		const body = output.slice(output.indexOf("---", 4) + 4);

		expect(body.trim()).toBe("# Impeccable Finish Reviewer\n\nBody text.");
	});

	test("translates every tool the bundle actually uses", () => {
		const source = CLAUDE_SOURCE.replace(
			"tools: Read, Bash, Glob, Grep",
			"tools: Read, Write, Edit, Bash, Glob, Grep",
		);

		expect(translateClaudeAgent(source, FILE)).toContain(
			"tools: read, write, edit, bash, glob, grep, yield",
		);
	});
});

describe("translateClaudeAgent rejects", () => {
	test("an unrecognised tool name, naming the file and the value", () => {
		const source = CLAUDE_SOURCE.replace("tools: Read, Bash, Glob, Grep", "tools: Read, Telepathy");

		expect(() => translateClaudeAgent(source, FILE)).toThrow(
			'impeccable-finish-reviewer.md: unrecognised tool name "Telepathy"',
		);
	});

	test("an effort outside OMP's vocabulary, naming the file and the value", () => {
		const source = CLAUDE_SOURCE.replace("effort: high", "effort: extreme");

		expect(() => translateClaudeAgent(source, FILE)).toThrow(
			'impeccable-finish-reviewer.md: effort "extreme" is not one of',
		);
	});

	test("a file with no front-matter delimiter, naming the file", () => {
		expect(() => translateClaudeAgent("# Just a body\n", FILE)).toThrow(
			"impeccable-finish-reviewer.md: missing front-matter delimiter",
		);
		expect(() => translateClaudeAgent("---\nname: x\n", FILE)).toThrow(
			"impeccable-finish-reviewer.md: missing front-matter delimiter",
		);
	});
});

describe("translateClaudeAgent is idempotent", () => {
	test("translating its own output changes nothing", () => {
		const once = translateClaudeAgent(CLAUDE_SOURCE, FILE);

		// A re-vendor re-runs the translation over a tree we already wrote, so a
		// non-fixed-point would show up as a spurious diff on every update.
		expect(translateClaudeAgent(once, FILE)).toBe(once);
	});
});
