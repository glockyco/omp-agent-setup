import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type * as CommitModule from "../plugin/extensions/personal-commit.ts";
import type { CommandRunner } from "../plugin/extensions/personal-commit.ts";

// PERSONAL_PLUGIN_DIR selects an installed release at run time, so the module
// path cannot be static; the default is the source payload.
const pluginRoot = process.env.PERSONAL_PLUGIN_DIR ?? join(import.meta.dir, "..", "plugin");
const { executeCommit, formatCommitMessage } = (await import(
	pathToFileURL(join(pluginRoot, "extensions", "personal-commit.ts")).href
)) as typeof CommitModule;

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
	const root = mkdtempSync(join(tmpdir(), "personal commit test "));
	temporaryRepositories.push(root);
	git(root, "init", "-q");
	git(root, "config", "user.name", "Commit Test");
	git(root, "config", "user.email", "commit@example.test");
	return root;
}

describe("Git transport", () => {
	test("creates and amends real hook-authorized commits with repository and message paths containing spaces", async () => {
		const root = disposableRepository();
		const hook = join(root, ".git", "hooks", "commit-msg");
		writeFileSync(
			hook,
			"#!/bin/sh\nprintf 'hook\\n' >> 'hook ran'\ncase \"$(cat \"$1\")\" in *'stable reason'*) exit 0;; *) exit 19;; esac\n",
		);
		if (process.platform !== "win32") chmodSync(hook, 0o755);
		const messageTemp = join(root, "message temp with spaces");
		mkdirSync(messageTemp);
		const previous = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
		const calls: string[][] = [];
		const runner: CommandRunner = async (args, cwd) => {
			calls.push(args);
			const child = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
			return {
				exitCode: child.exitCode,
				stdout: child.stdout.toString(),
				stderr: child.stderr.toString(),
			};
		};
		try {
			Object.assign(process.env, { TEMP: messageTemp, TMP: messageTemp, TMPDIR: messageTemp });
			for (const action of ["commit", "amend"] as const) {
				writeFileSync(join(root, "payload.txt"), `${action}\n`);
				git(root, "add", "payload.txt");
				writeFileSync(join(root, "unstaged.txt"), "must remain unstaged\n");
				const input = {
					action,
					subject: `test: exercise ${action} transport`,
					body: "The stable reason proves the real hook reads one correctly addressed message file.",
					repo: root,
				};
				const result = await executeCommit(input, root, runner);
				expect(result.repository).toBe(git(root, "rev-parse", "--show-toplevel").trim());
				expect(git(root, "log", "-1", "--format=%B")).toBe(`${formatCommitMessage(input)}\n`);
				expect(git(root, "status", "--porcelain")).toContain("?? unstaged.txt");
			}
			expect(git(root, "rev-list", "--count", "HEAD").trim()).toBe("1");
			await expect(Bun.file(join(root, "hook ran")).text()).resolves.toBe("hook\nhook\n");
			const mutations = calls.filter(args => args[0] === "commit");
			expect(mutations.map(args => args.slice(0, -1))).toEqual([
				["commit", "-F"],
				["commit", "--amend", "-F"],
			]);
			for (const args of mutations) {
				const messagePath = args.at(-1);
				if (!messagePath) throw new Error("Commit mutation has no message path");
				expect(messagePath).toContain("message temp with spaces");
				expect(existsSync(messagePath)).toBe(false);
			}
			expect(calls.every(args => args[0] === "rev-parse" || args[0] === "commit")).toBe(true);
			expect(calls.flat()).not.toContain("--no-verify");
		} finally {
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}
	}, 30_000);

	test.each(["commit", "amend"] as const)(
		"a real rejecting hook remains authoritative for %s",
		async action => {
			const root = disposableRepository();
			writeFileSync(join(root, "payload.txt"), "one\n");
			git(root, "add", "payload.txt");
			let before: string | undefined;
			if (action === "amend") {
				git(root, "commit", "-m", "test: initial commit");
				before = git(root, "rev-parse", "HEAD");
				writeFileSync(join(root, "payload.txt"), "two\n");
				git(root, "add", "payload.txt");
			}
			writeFileSync(join(root, "unstaged.txt"), "never stage this\n");
			const hook = join(root, ".git", "hooks", "commit-msg");
			writeFileSync(
				hook,
				"#!/bin/sh\nprintf 'rejected\\n' >> 'hook rejection'\nprintf '%s\\n' \"$1\" >> 'rejected message path'\nprintf 'real hook rejected message\\n' >&2\nexit 19\n",
			);
			if (process.platform !== "win32") chmodSync(hook, 0o755);
			const messageTemp = join(root, "rejected message temp with spaces");
			mkdirSync(messageTemp);
			const previous = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
			const calls: string[][] = [];
			const runner: CommandRunner = async (args, cwd) => {
				calls.push(args);
				const child = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
				return {
					exitCode: child.exitCode,
					stdout: child.stdout.toString(),
					stderr: child.stderr.toString(),
				};
			};
			try {
				Object.assign(process.env, { TEMP: messageTemp, TMP: messageTemp, TMPDIR: messageTemp });
				await expect(
					executeCommit(
						{
							action,
							subject: "test: rejected transport",
							body: "Git must preserve hook authority rather than retrying with a bypass.",
							repo: root,
						},
						root,
						runner,
					),
				).rejects.toThrow(/real hook rejected message/);
			} finally {
				for (const [key, value] of Object.entries(previous)) {
					if (value === undefined) delete process.env[key];
					else process.env[key] = value;
				}
			}
			// Git copies -F input to COMMIT_EDITMSG before invoking its authoritative hook.
			await expect(Bun.file(join(root, "rejected message path")).text()).resolves.toContain(
				"COMMIT_EDITMSG",
			);
			const mutations = calls.filter(args => args[0] === "commit");
			expect(mutations).toHaveLength(1);
			const messagePath = mutations[0]?.at(-1);
			if (!messagePath) throw new Error("Missing rejecting Git mutation message path");
			expect(messagePath).toContain("rejected message temp with spaces");
			expect(existsSync(messagePath)).toBe(false);
			expect(calls.flat()).not.toContain("--no-verify");
			await expect(Bun.file(join(root, "hook rejection")).text()).resolves.toBe("rejected\n");
			expect(git(root, "status", "--porcelain")).toContain("?? unstaged.txt");
			expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("payload.txt");
			if (before) expect(git(root, "rev-parse", "HEAD")).toBe(before);
			else expect(() => git(root, "rev-parse", "HEAD")).toThrow();
			expect(git(root, "remote", "-v")).toBe("");
		},
		30_000,
	);

	test("commits in a named repository and leaves the session repository untouched", async () => {
		const session = disposableRepository();
		const sibling = disposableRepository();
		writeFileSync(join(session, "session.txt"), "session\n");
		git(session, "add", "session.txt");
		writeFileSync(join(sibling, "sibling.txt"), "sibling\n");
		git(sibling, "add", "sibling.txt");

		const { repository } = await executeCommit(
			{
				action: "commit",
				subject: "test: commit in a named repository",
				body: "A task spanning two repositories must state which one receives the commit.",
				repo: sibling,
			},
			session,
		);

		expect(repository).toBe(git(sibling, "rev-parse", "--show-toplevel").trim());
		expect(git(sibling, "log", "-1", "--format=%s").trim()).toBe(
			"test: commit in a named repository",
		);
		expect(git(session, "status", "--porcelain")).toContain("A  session.txt");
		expect(() => git(session, "rev-parse", "HEAD")).toThrow();
	}, 30_000);

	test("resolves a relative target against the session directory", async () => {
		const parent = mkdtempSync(join(tmpdir(), "personal-commit-parent-"));
		temporaryRepositories.push(parent);
		const nested = join(parent, "nested");
		mkdirSync(nested);
		git(nested, "init", "-q");
		git(nested, "config", "user.name", "Commit Test");
		git(nested, "config", "user.email", "commit@example.test");
		writeFileSync(join(nested, "payload.txt"), "one\n");
		git(nested, "add", "payload.txt");

		const { repository } = await executeCommit(
			{
				action: "commit",
				subject: "test: resolve a relative target",
				body: "A relative path keeps the common case short without hiding the target.",
				repo: "nested",
			},
			parent,
		);

		expect(repository).toBe(git(nested, "rev-parse", "--show-toplevel").trim());
		expect(git(nested, "rev-list", "--count", "HEAD").trim()).toBe("1");
	}, 30_000);

	test("reports the work tree root when the target is a subdirectory", async () => {
		const root = disposableRepository();
		const inner = join(root, "inner");
		mkdirSync(inner);
		writeFileSync(join(inner, "payload.txt"), "one\n");
		git(root, "add", "inner/payload.txt");

		const { repository } = await executeCommit(
			{
				action: "commit",
				subject: "test: report the work tree root",
				body: "Git walks up from a subdirectory, so the given path alone does not identify the target.",
				repo: inner,
			},
			root,
		);

		expect(repository).toBe(git(root, "rev-parse", "--show-toplevel").trim());
		expect(git(root, "rev-list", "--count", "HEAD").trim()).toBe("1");
	}, 30_000);

	test("rejects a target that is missing, not a directory, or outside a work tree", async () => {
		const root = disposableRepository();
		const outside = mkdtempSync(join(tmpdir(), "personal-commit-outside-"));
		temporaryRepositories.push(outside);
		const file = join(root, "payload.txt");
		writeFileSync(file, "one\n");
		const attempt = (repo: string) =>
			executeCommit(
				{
					action: "commit",
					subject: "test: reject an unusable target",
					body: "A caller must learn about a wrong target before any message file exists.",
					repo,
				},
				root,
			);

		await expect(attempt(join(root, "absent"))).rejects.toThrow(/does not exist.*absent/su);
		await expect(attempt(file)).rejects.toThrow(/not a directory/u);
		await expect(attempt(outside)).rejects.toThrow(/not inside a Git work tree/u);
		expect(() => git(root, "rev-parse", "HEAD")).toThrow();
	}, 30_000);
});
