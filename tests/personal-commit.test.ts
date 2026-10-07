import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type * as CommitModule from "../plugin/extensions/personal-commit.ts";
import type { CommandRunner } from "../plugin/extensions/personal-commit.ts";

// PERSONAL_PLUGIN_DIR selects an installed release at run time, so the module
// path cannot be static; the default is the source payload.
const pluginRoot = process.env.PERSONAL_PLUGIN_DIR ?? join(import.meta.dir, "..", "plugin");
const { executeCommit, formatCommitMessage, parseCommitInput, wrapBody } = (await import(
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

	test("keeps the reader list separate from prose without blank lines", () => {
		const body = `The analysis consumes one normalized episode table, but identification
runs store raw attempt records with transcripts. The reader:
- maps strategies to the three tool-use settings;
- links transformed cases to their untransformed counterparts;
- counts a success only for a single reported line that equals the tracked
  fault line;
- keeps round-limit and malformed answers as unanswered episodes, and
  excludes and counts API, transport, and empty-response failures;
- prices cache writes the way the run's usage totals do;
- subtracts the repair-test time from episode wall time.
Snapshots built before the generator recorded difficulty get it from
LeetCodeDataset at a pinned revision. Unknown metadata, strategies, tools,
or errors stop the conversion instead of being guessed.`;
		const message = formatCommitMessage({ subject: "feat: read episode records", body });
		expect(message).toContain("with transcripts. The reader:\n- maps strategies");
		expect(message).toContain("\n- links transformed cases");
		expect(message).toContain("\n- counts a success");
		expect(message).toContain("\n  tracked fault line;\n- keeps round-limit");
		expect(message).toContain("\n  excludes and counts API, transport, and empty-response failures;");
		expect(message).toContain("\n- prices cache writes");
		expect(message).toContain(
			"\n- subtracts the repair-test time from episode wall time.\nSnapshots built",
		);
		expect(message.split("\n").every(line => line.length <= 72)).toBe(true);
	});

	test("wraps all bullet markers with a hanging indent", () => {
		const words = Array<string>(20).fill("word");
		for (const marker of ["-", "*", "+"]) {
			expect(wrapBody(`${marker} ${words.join(" ")}`)).toBe(
				`${marker} ${words.slice(0, 14).join(" ")}\n  ${words.slice(14).join(" ")}`,
			);
		}
	});

	test("wraps ordered lists including multi-digit markers", () => {
		const words = Array<string>(20).fill("word");
		const markers = ["1.", "2)", "10.", "10)"];
		const body = markers.map(marker => `${marker} ${words.join(" ")}`).join("\n");
		expect(wrapBody(body)).toBe(
			markers
				.map(marker => {
					const count = marker.length === 2 ? 14 : 13;
					return `${marker} ${words.slice(0, count).join(" ")}\n${" ".repeat(marker.length + 1)}${words.slice(count).join(" ")}`;
				})
				.join("\n"),
		);
	});

	test("preserves nested markers even at the code indentation threshold", () => {
		const words = Array<string>(20).fill("word");
		expect(wrapBody(`- Parent item\n    - ${words.join(" ")}\n  * Another nested item`)).toBe(
			`- Parent item\n    - ${words.slice(0, 13).join(" ")}\n      ${words.slice(13).join(" ")}\n  * Another nested item`,
		);
	});

	test("reflows indented item continuations but ends a list at unindented prose", () => {
		expect(wrapBody("- First part\n  of the item\nFollowing prose\ncontinues here.")).toBe(
			"- First part of the item\nFollowing prose continues here.",
		);
		expect(wrapBody("- First item\n\nAnother paragraph.")).toBe("- First item\n\nAnother paragraph.");
	});

	test("preserves fenced code including blank lines and overlong lines", () => {
		const code = `\`\`\`ts\nconst value = "${"x".repeat(90)}";\n\n    run(  value );\n\`\`\``;
		expect(wrapBody(`Why this matters.\n${code}\nFollowing prose\nreflows.`)).toBe(
			`Why this matters.\n${code}\nFollowing prose reflows.`,
		);
		expect(wrapBody(`\`\`\`\`\n\`\`\`\n\n- not a list\n\`\`\`\``)).toBe(
			`\`\`\`\`\n\`\`\`\n\n- not a list\n\`\`\`\``,
		);
	});

	test("preserves indented code at body edges through message formatting", () => {
		const code = `    const value = "${"x".repeat(90)}";  \n\tuse(  value );`;
		expect(formatCommitMessage({ subject: "fix: keep code indentation", body: code })).toBe(
			`fix: keep code indentation\n\n${code}\n`,
		);
	});

	test("preserves final Git trailer lines without reflow", () => {
		const trailers = `Signed-off-by: Example Person <person@example.test>\nFixes #123\nBREAKING CHANGE: ${"word ".repeat(20).trim()}`;
		expect(wrapBody(`The incompatibility needs an explanation.\n\n${trailers}`)).toBe(
			`The incompatibility needs an explanation.\n\n${trailers}`,
		);
		expect(wrapBody(trailers)).toBe(trailers);
	});

	test("does not treat mixed or non-final prose as a trailer block", () => {
		expect(wrapBody("Reason: one line\nand another line.")).toBe(
			"Reason: one line and another line.",
		);
		expect(wrapBody("Reason: one line\nFixes #123\n\nFinal prose.")).toBe(
			"Reason: one line Fixes #123\n\nFinal prose.",
		);
	});

	test("reflows ordinary prose and normalizes paragraph separation as before", () => {
		const words = Array<string>(20).fill("word");
		expect(
			wrapBody(
				`  ${words.slice(0, 10).join(" ")}\n${words.slice(10).join(" ")}\n\n \nNext paragraph.`,
			),
		).toBe(`${words.slice(0, 14).join(" ")}\n${words.slice(14).join(" ")}\n\nNext paragraph.`);
	});

	test("does not break overlong list tokens", () => {
		const token = `https://example.test/${"x".repeat(90)}`;
		expect(wrapBody(`- Explain why ${token} stays intact.`)).toBe(
			`- Explain why\n  ${token}\n  stays intact.`,
		);
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
	});

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
	});

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
	});

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
	});

	test("preview names the path it would use while staying inert", async () => {
		const calls: string[][] = [];
		const runner: CommandRunner = async args => {
			calls.push(args);
			return { exitCode: 0, stdout: "", stderr: "" };
		};

		const { message, repository } = await executeCommit(
			{
				action: "preview",
				subject: "test: preview names its target",
				body: "A preview shows the path it would use without reading a filesystem it may not own.",
				repo: "sibling",
			},
			"/unused",
			runner,
		);

		expect(repository).toBe("/unused/sibling");
		expect(message).toContain("test: preview names its target");
		expect(calls).toEqual([]);
	});

	test("requests exactly one Git mutation, in the resolved repository", async () => {
		const root = disposableRepository();
		const calls: Array<{ args: string[]; cwd: string }> = [];
		// A stub stands in for Git so the arguments can be observed. It answers
		// the repository query the way Git does, because resolution now precedes
		// the mutation.
		const runner: CommandRunner = async (args, cwd) => {
			calls.push({ args, cwd });
			const stdout = args[0] === "rev-parse" ? `${root}\n` : "ok";
			return { exitCode: 0, stdout, stderr: "" };
		};
		await executeCommit(
			{ action: "commit", subject: "feat: add transport", body: "A stable reason exists." },
			root,
			runner,
		);
		const mutations = calls.filter(call => call.args[0] === "commit");
		expect(mutations).toHaveLength(1);
		expect(mutations[0]?.cwd).toBe(root);
		expect(mutations[0]?.args.slice(0, 2)).toEqual(["commit", "-F"]);
		expect(mutations[0]?.args).not.toContain("--no-verify");
		expect(calls.filter(call => call.args[0] !== "commit").map(call => call.args)).toEqual([
			["rev-parse", "--show-toplevel"],
		]);
	});
});
