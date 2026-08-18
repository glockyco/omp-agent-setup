import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export type CommitAction = "commit" | "amend" | "preview";

export interface CommitInput {
	action: CommitAction;
	subject: string;
	body: string;
	/** Repository to commit in. Relative values resolve against the session directory. */
	repo?: string;
}

export interface CommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export type CommandRunner = (args: string[], cwd: string) => Promise<CommandResult>;

const SUBJECT_PATTERN = /^[a-z]+(\([^)]+\))?!?: .+/u;
const LINE_LENGTH = 72;

export function parseCommitInput(params: Record<string, unknown>): CommitInput {
	const action = params.action;
	const subject = params.subject;
	const body = params.body;
	if (action !== "commit" && action !== "amend" && action !== "preview") {
		throw new Error("action must be commit, amend, or preview");
	}
	if (typeof subject !== "string" || typeof body !== "string") {
		throw new Error("subject and body must be strings");
	}
	if (subject.includes("\\n") || body.includes("\\n")) {
		throw new Error("subject and body must use real structured fields, not literal \\n text");
	}
	const repo = params.repo;
	if (repo !== undefined && typeof repo !== "string") {
		throw new Error("repo must be a string path to a repository");
	}
	return repo === undefined ? { action, subject, body } : { action, subject, body, repo };
}

export function wrapBody(body: string, lineLength = LINE_LENGTH): string {
	return body
		.trim()
		.split(/\n\s*\n/u)
		.map(paragraph => wrapParagraph(paragraph, lineLength))
		.join("\n\n");
}

export function formatCommitMessage(input: Pick<CommitInput, "subject" | "body">): string {
	const subject = input.subject.trim();
	if (!SUBJECT_PATTERN.test(subject)) {
		throw new Error("subject must match Conventional Commits: type[(scope)]!: summary");
	}
	if (subject.length > LINE_LENGTH) throw new Error("subject must be 72 characters or less");
	if (subject.includes("\n")) throw new Error("subject must be one line");

	const body = input.body.trim();
	if (!body) throw new Error("commit body is required and must explain why the change exists");
	return `${subject}\n\n${wrapBody(body)}\n`;
}

/**
 * Verify the repository a mutation will land in, and report its work tree root.
 *
 * A caller that names the wrong directory must learn so here, before a message
 * file exists and before Git mutates anything. The root is reported rather than
 * the given path because Git walks up from a subdirectory, so the given path
 * alone does not identify the repository that receives the commit.
 */
export async function resolveRepository(
	repo: string | undefined,
	cwd: string,
	runner: CommandRunner = runGit,
): Promise<string> {
	const target = repo === undefined ? cwd : resolve(cwd, repo);
	const stats = await stat(target).catch(() => undefined);
	if (!stats) throw new Error(`repository path does not exist: ${target}`);
	if (!stats.isDirectory()) throw new Error(`repository path is not a directory: ${target}`);

	const toplevel = await runner(["rev-parse", "--show-toplevel"], target);
	if (toplevel.exitCode !== 0) {
		throw new Error(`repository path is not inside a Git work tree: ${target}`);
	}
	return toplevel.stdout.trim();
}

export async function executeCommit(
	input: CommitInput,
	cwd: string,
	runner: CommandRunner = runGit,
): Promise<{ message: string; repository: string; result?: CommandResult }> {
	const message = formatCommitMessage(input);
	// Preview stays inert: it reads no filesystem and runs no Git, so it reports
	// the path it would use rather than a verified work tree root.
	if (input.action === "preview") {
		return { message, repository: input.repo === undefined ? cwd : resolve(cwd, input.repo) };
	}

	const repository = await resolveRepository(input.repo, cwd, runner);
	const directory = await mkdtemp(join(tmpdir(), "personal-commit-"));
	const messagePath = join(directory, "message.txt");
	try {
		await writeFile(messagePath, message, "utf8");
		const args =
			input.action === "amend"
				? ["commit", "--amend", "-F", messagePath]
				: ["commit", "-F", messagePath];
		const result = await runner(args, repository);
		if (result.exitCode !== 0) {
			throw new Error(result.stderr.trim() || result.stdout.trim() || "git commit failed");
		}
		return { message, repository, result };
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function wrapParagraph(paragraph: string, lineLength: number): string {
	const words = paragraph.trim().replace(/\s+/gu, " ").split(" ");
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		if (!current) {
			current = word;
		} else if (current.length + 1 + word.length <= lineLength) {
			current += ` ${word}`;
		} else {
			lines.push(current);
			current = word;
		}
	}
	if (current) lines.push(current);
	return lines.join("\n");
}

async function runGit(args: string[], cwd: string): Promise<CommandResult> {
	const process = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);
	return { exitCode, stdout, stderr };
}

export default function personalCommit(pi: ExtensionAPI): void {
	const z = pi.zod;
	pi.registerTool({
		name: "personal_commit",
		label: "Personal Commit",
		description:
			"Preview, create, or amend a Conventional Commit from separate subject and causal body fields. Does not stage or push.",
		parameters: z.object({
			action: z.enum(["commit", "amend", "preview"] as const),
			subject: z.string(),
			body: z.string(),
			repo: z
				.string()
				.optional()
				.describe(
					"repository to commit in; relative paths resolve against the session directory, and the default is the session repository",
				),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			if (signal?.aborted) throw new Error("commit cancelled");
			const input = parseCommitInput(params);
			const { message, repository, result } = await executeCommit(input, ctx.cwd);
			const output = result?.stdout.trim();
			const target = input.action === "preview" ? "would commit in" : "repository";
			return {
				content: [{ type: "text", text: `${target}: ${repository}\n${output || message}` }],
				details: { action: input.action, message, repository },
			};
		},
	});
}
