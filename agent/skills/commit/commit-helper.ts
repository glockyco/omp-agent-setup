#!/usr/bin/env bun

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type CommitAction = "commit" | "amend" | "dry-run";

export interface CommitInput {
	action: CommitAction;
	subject: string;
	body?: string;
}

export interface CommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export type CommandRunner = (cmd: string[]) => Promise<CommandResult>;

export interface RunCommitHelperOptions {
	input: CommitInput;
	runner?: CommandRunner;
	writeText?: (path: string, text: string) => Promise<void>;
	makeTempPath?: () => Promise<string> | string;
	lineLength?: number;
}

export interface RunCommitHelperResult {
	exitCode: number;
	message: string;
	messagePath?: string;
	stdout: string;
	stderr: string;
}

const DEFAULT_LINE_LENGTH = 72;
const SUBJECT_PATTERN = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?: .+/u;

export function wrapBody(body: string, lineLength = DEFAULT_LINE_LENGTH): string {
	return body
		.trim()
		.split(/\n\s*\n/u)
		.map((paragraph) => wrapParagraph(paragraph, lineLength))
		.join("\n\n");
}

export function buildCommitMessage(input: Pick<CommitInput, "subject" | "body">): string {
	const subject = input.subject.trim();
	if (!SUBJECT_PATTERN.test(subject)) {
		throw new Error("subject must match Conventional Commits: type[(scope)]: summary");
	}
	if (subject.length > 72) throw new Error("subject must be 72 characters or less");

	const body = input.body?.trim();
	if (!body) return `${subject}\n`;
	return `${subject}\n\n${wrapBody(body)}\n`;
}

export function parseCommitInput(args: string[], env: Record<string, string | undefined>): CommitInput {
	const firstArgAction = args[0]?.startsWith("-") ? undefined : readAction(args[0]);
	let action = firstArgAction ?? readAction(env.COMMIT_ACTION) ?? "commit";
	let subject = env.COMMIT_SUBJECT ?? "";
	let body = env.COMMIT_BODY;

	for (let index = firstArgAction ? 1 : 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--subject") subject = readValue(args, ++index, "--subject");
		else if (arg === "--body") body = readValue(args, ++index, "--body");
		else if (arg === "--action") action = requireAction(readValue(args, ++index, "--action"));
		else throw new Error(`unknown argument ${arg}`);
	}

	if (!subject.trim()) throw new Error("COMMIT_SUBJECT or --subject is required");
	return { action, subject, body };
}

export async function runCommitHelper({
	input,
	runner = runCommand,
	writeText = writeFile,
	makeTempPath = defaultTempPath,
}: RunCommitHelperOptions): Promise<RunCommitHelperResult> {
	const message = buildCommitMessage(input);

	if (input.action === "dry-run") {
		const lint = await lintMessageText(message, runner);
		return { exitCode: lint.exitCode, message, stdout: lint.stdout, stderr: lint.stderr };
	}

	const messagePath = await makeTempPath();
	await writeText(messagePath, message);
	const lint = await runner(["bunx", "commitlint", "--edit", messagePath]);
	if (lint.exitCode !== 0) {
		return { exitCode: lint.exitCode, message, messagePath, stdout: lint.stdout, stderr: lint.stderr };
	}

	const git = await runner(
		input.action === "amend"
			? ["git", "commit", "--amend", "-F", messagePath]
			: ["git", "commit", "-F", messagePath],
	);
	return { exitCode: git.exitCode, message, messagePath, stdout: git.stdout, stderr: git.stderr };
}

async function main(): Promise<number> {
	try {
		const input = parseCommitInput(Bun.argv.slice(2), process.env);
		const result = await runCommitHelper({ input });
		if (input.action === "dry-run" || result.exitCode !== 0) {
			console.log(result.message);
		}
		if (result.messagePath && result.exitCode !== 0) {
			console.error(`commit message left at ${result.messagePath}`);
		}
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		return result.exitCode;
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

function wrapParagraph(paragraph: string, lineLength: number): string {
	const words = paragraph.trim().replace(/\s+/gu, " ").split(" ");
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		if (word.length > lineLength) {
			if (current) lines.push(current);
			lines.push(word);
			current = "";
		} else if (!current) {
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

function readValue(args: string[], index: number, flag: string): string {
	const value = args[index];
	if (value === undefined) throw new Error(`${flag} requires a value`);
	return value;
}

function readAction(value: string | undefined): CommitAction | undefined {
	if (value === undefined) return undefined;
	if (value === "commit" || value === "amend" || value === "dry-run") return value;
	throw new Error("commit action must be commit, amend, or dry-run");
}

function requireAction(value: string): CommitAction {
	return readAction(value)!;
}

async function defaultTempPath(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "omp-commit-message-"));
	return join(dir, "message.txt");
}

async function lintMessageText(message: string, runner: CommandRunner): Promise<CommandResult> {
	const messagePath = await defaultTempPath();
	await writeFile(messagePath, message);
	return runner(["bunx", "commitlint", "--edit", messagePath]);
}

async function runCommand(cmd: string[]): Promise<CommandResult> {
	const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { exitCode, stdout, stderr };
}

if (import.meta.main) {
	process.exitCode = await main();
}
