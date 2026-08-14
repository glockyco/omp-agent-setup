import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type CommandRunner,
	executeCommit,
	formatCommitMessage,
	parseCommitInput,
	wrapBody,
} from "../extensions/personal-commit.ts";

const temporaryRepositories: string[] = [];

afterEach(() => {
	for (const directory of temporaryRepositories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function git(cwd: string, ...args: string[]): string {
	const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
	if (result.exitCode !== 0) throw new Error(result.stderr.toString());
	return result.stdout.toString();
}

function disposableRepository(): string {
	const root = mkdtempSync(join(tmpdir(), "personal-commit-test-"));
	temporaryRepositories.push(root);
	git(root, "init", "-q");
	git(root, "config", "user.name", "Commit Test");
	git(root, "config", "user.email", "commit@example.test");
	return root;
}

describe("structured input", () => {
	test("accepts all actions and rejects literal escaped newlines", () => {
		expect(
			parseCommitInput({ action: "preview", subject: "docs: explain policy", body: "State why." }),
		).toEqual({ action: "preview", subject: "docs: explain policy", body: "State why." });
		expect(() =>
			parseCommitInput({ action: "commit", subject: "docs: bad\\nsubject", body: "Why." }),
		).toThrow(/literal/);
		expect(() =>
			parseCommitInput({ action: "commit", subject: "docs: bad", body: "One\\nTwo" }),
		).toThrow(/literal/);
		expect(() => parseCommitInput({ action: "delete", subject: "docs: bad", body: "Why." })).toThrow(
			/action/,
		);
	});

	test("requires a conventional subject and causal body field", () => {
		expect(() => formatCommitMessage({ subject: "bad", body: "Reason." })).toThrow(/Conventional/);
		expect(() => formatCommitMessage({ subject: "docs: explain", body: "" })).toThrow(/body/);
		expect(() =>
			formatCommitMessage({ subject: `docs: ${"x".repeat(70)}`, body: "Reason." }),
		).toThrow(/72/);
	});
});

describe("message formatting", () => {
	test("preserves paragraphs and indivisible long tokens", () => {
		const url = "https://example.test/a/path/that/is/longer/than/the/ordinary/wrapping/limit";
		const formatted = wrapBody(
			`The previous path was mutable, so the package could drift after activation. ${url}\n\nThe store path fixes that drift.`,
		);
		expect(formatted).toContain(`\n${url}\n`);
		expect(formatted).toContain("\n\nThe store path fixes that drift.");
		expect(
			formatted
				.split("\n")
				.filter(line => line !== url)
				.every(line => line.length <= 72),
		).toBe(true);
	});

	test("preview has no command side effects", async () => {
		const calls: string[][] = [];
		const runner: CommandRunner = async args => {
			calls.push(args);
			return { exitCode: 0, stdout: "", stderr: "" };
		};
		const result = await executeCommit(
			{
				action: "preview",
				subject: "docs: explain immutable plugin",
				body: "The host needs a stable capability path across activations.",
			},
			"/unused",
			runner,
		);
		expect(result.message).toContain("docs: explain immutable plugin\n\n");
		expect(calls).toEqual([]);
	});
});

describe("Git transport", () => {
	test("creates and amends a real commit while repository hooks run", async () => {
		const root = disposableRepository();
		const hook = join(root, ".git", "hooks", "commit-msg");
		writeFileSync(
			hook,
			`#!/bin/sh\nprintf 'hook\\n' >> ${JSON.stringify(join(root, "hook-ran"))}\ngrep -q 'stable reason' "$1"\n`,
		);
		chmodSync(hook, 0o755);
		writeFileSync(join(root, "payload.txt"), "one\n");
		git(root, "add", "payload.txt");

		await executeCommit(
			{
				action: "commit",
				subject: "test: exercise commit transport",
				body: "The stable reason proves that the repository commit hook reads the generated message.",
			},
			root,
		);
		expect(git(root, "log", "-1", "--format=%B")).toContain("stable reason");

		writeFileSync(join(root, "payload.txt"), "two\n");
		git(root, "add", "payload.txt");
		await executeCommit(
			{
				action: "amend",
				subject: "test: exercise amended transport",
				body: "The stable reason also proves that amend keeps the repository hook active.",
			},
			root,
		);
		expect(git(root, "rev-list", "--count", "HEAD").trim()).toBe("1");
		await expect(Bun.file(join(root, "hook-ran")).text()).resolves.toBe("hook\nhook\n");
	});

	test("uses only the requested Git commit arguments", async () => {
		const calls: Array<{ args: string[]; cwd: string }> = [];
		const runner: CommandRunner = async (args, cwd) => {
			calls.push({ args, cwd });
			return { exitCode: 0, stdout: "ok", stderr: "" };
		};
		await executeCommit(
			{ action: "commit", subject: "feat: add transport", body: "A stable reason exists." },
			"/repo",
			runner,
		);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.cwd).toBe("/repo");
		expect(calls[0]?.args.slice(0, 2)).toEqual(["commit", "-F"]);
		expect(calls[0]?.args).not.toContain("--no-verify");
	});
});
