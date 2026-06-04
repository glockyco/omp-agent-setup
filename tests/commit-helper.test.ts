import { describe, expect, test } from "bun:test";
import {
	buildCommitMessage,
	type CommandRunner,
	parseCommitInput,
	runCommitHelper,
	wrapBody,
} from "../agent/skills/commit/commit-helper.ts";

describe("wrapBody", () => {
	test("wraps paragraphs without breaking paragraph boundaries", () => {
		const body =
			"RunFinalizeCommand now defaults to the runtime location source when callers omit a cache. Existing finalize tests exercise publishing behavior, not Unity asset lookup, so they pass an explicit empty location cache.\n\nThis keeps .NET unit tests away from Unity ECalls while preserving the runtime default used by the command registry.";

		const wrapped = wrapBody(body, 72);

		expect(wrapped).toBe(
			"RunFinalizeCommand now defaults to the runtime location source when\n" +
				"callers omit a cache. Existing finalize tests exercise publishing\n" +
				"behavior, not Unity asset lookup, so they pass an explicit empty\n" +
				"location cache.\n" +
				"\n" +
				"This keeps .NET unit tests away from Unity ECalls while preserving the\n" +
				"runtime default used by the command registry.",
		);
		expect(wrapped.split("\n").every(line => line.length <= 72)).toBe(true);
	});

	test("keeps overlong tokens intact instead of splitting them", () => {
		const wrapped = wrapBody("prefix supercalifragilisticexpialidocious suffix", 10);

		expect(wrapped).toBe("prefix\nsupercalifragilisticexpialidocious\nsuffix");
	});
});

describe("buildCommitMessage", () => {
	test("builds a conventional commit message with wrapped body", () => {
		const message = buildCommitMessage({
			subject: "test(mod): isolate location cache in finalize tests",
			body:
				"Existing finalize tests exercise publishing behavior, not Unity asset lookup, so they pass an explicit empty location cache.",
		});

		expect(message).toBe(
			"test(mod): isolate location cache in finalize tests\n" +
				"\n" +
				"Existing finalize tests exercise publishing behavior, not Unity asset\n" +
				"lookup, so they pass an explicit empty location cache.\n",
		);
	});

	test("rejects body commits with invalid subjects before shelling out", () => {
		expect(() =>
			buildCommitMessage({
				subject: "bad subject",
				body: "Body text.",
			}),
		).toThrow(/subject must match Conventional Commits/);
	});
});

describe("parseCommitInput", () => {
	test("reads action, subject, and body from structured environment", () => {
		const input = parseCommitInput([], {
			COMMIT_ACTION: "amend",
			COMMIT_SUBJECT: "docs: tighten commit workflow",
			COMMIT_BODY: "Explain the reason in ordinary prose.",
		});

		expect(input).toEqual({
			action: "amend",
			subject: "docs: tighten commit workflow",
			body: "Explain the reason in ordinary prose.",
		});
	});

	test("lets flags override environment values for human CLI use", () => {
		const input = parseCommitInput(
			["dry-run", "--subject", "feat: add helper", "--body", "Human-supplied body text."],
			{
				COMMIT_ACTION: "commit",
				COMMIT_SUBJECT: "docs: ignored",
				COMMIT_BODY: "ignored",
			},
		);

		expect(input).toEqual({
			action: "dry-run",
			subject: "feat: add helper",
			body: "Human-supplied body text.",
		});
	});

	test("parses --action and reports malformed flags", () => {
		expect(parseCommitInput(["--action", "amend"], { COMMIT_SUBJECT: "docs: update" })).toEqual({
			action: "amend",
			subject: "docs: update",
			body: undefined,
		});
		expect(() => parseCommitInput(["--body"], { COMMIT_SUBJECT: "docs: update" })).toThrow(
			/--body requires a value/,
		);
		expect(() => parseCommitInput(["--unknown"], { COMMIT_SUBJECT: "docs: update" })).toThrow(
			/unknown argument --unknown/,
		);
		expect(() => parseCommitInput([], { COMMIT_ACTION: "oops" })).toThrow(
			/commit action must be commit, amend, or dry-run/,
		);
	});
});

describe("runCommitHelper", () => {
	test("dry-run validates and returns the generated message without git side effects", async () => {
		const calls: string[][] = [];
		const runner: CommandRunner = async cmd => {
			calls.push(cmd);
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const result = await runCommitHelper({
			input: {
				action: "dry-run",
				subject: "docs: tighten commit workflow",
				body: "Use structured inputs so agents do not hand-wrap commit bodies.",
			},
			runner,
		});

		expect(result.exitCode).toBe(0);
		expect(result.messagePath).toBeUndefined();
		expect(result.message).toContain("docs: tighten commit workflow\n\n");
		expect(calls.map(call => call[0])).toEqual(["bunx"]);
	});

	test("commit action writes an internal file and commits with -F", async () => {
		const calls: string[][] = [];
		const writes = new Map<string, string>();
		let counter = 0;
		const runner: CommandRunner = async cmd => {
			calls.push(cmd);
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const result = await runCommitHelper({
			input: {
				action: "commit",
				subject: "test: add helper coverage",
				body: "Exercise command construction without touching a real git repository.",
			},
			runner,
			writeText: async (path, text) => {
				writes.set(path, text);
			},
			makeTempPath: () => `/tmp/commit-message-${++counter}.txt`,
		});

		expect(result.exitCode).toBe(0);
		expect(result.messagePath).toBe("/tmp/commit-message-1.txt");
		expect(writes.get("/tmp/commit-message-1.txt")).toBe(result.message);
		expect(calls).toEqual([
			["bunx", "commitlint", "--edit", "/tmp/commit-message-1.txt"],
			["git", "commit", "-F", "/tmp/commit-message-1.txt"],
		]);
	});

	test("returns lint failure without running git", async () => {
		const calls: string[][] = [];
		const runner: CommandRunner = async cmd => {
			calls.push(cmd);
			return cmd[0] === "bunx"
				? { exitCode: 1, stdout: "", stderr: "lint failed" }
				: { exitCode: 0, stdout: "", stderr: "" };
		};

		const result = await runCommitHelper({
			input: {
				action: "commit",
				subject: "docs: update helper",
				body: "Body text.",
			},
			runner,
			writeText: async () => {},
			makeTempPath: () => "/tmp/message.txt",
		});

		expect(result).toEqual({
			exitCode: 1,
			message: "docs: update helper\n\nBody text.\n",
			messagePath: "/tmp/message.txt",
			stdout: "",
			stderr: "lint failed",
		});
		expect(calls).toEqual([["bunx", "commitlint", "--edit", "/tmp/message.txt"]]);
	});

	test("amend action commits with --amend and -F", async () => {
		const calls: string[][] = [];
		const runner: CommandRunner = async cmd => {
			calls.push(cmd);
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		await runCommitHelper({
			input: {
				action: "amend",
				subject: "docs: update helper",
				body: "Body text.",
			},
			runner,
			writeText: async () => {},
			makeTempPath: () => "/tmp/message.txt",
		});

		expect(calls.at(-1)).toEqual(["git", "commit", "--amend", "-F", "/tmp/message.txt"]);
	});
});
