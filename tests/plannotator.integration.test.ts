import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnnotationBoundary } from "../plugin/extensions/plannotator";
import { createHost, type Host, until as waitUntil } from "./fixtures/plannotator-harness";

// Real Windows CIM/termination utilities and compiled fixtures are external processes.
const nativeCaseTimeout = 30_000;

interface RunningReview {
	pid: number;
	descendant?: number;
	path: string;
	text: string;
	fileMode: number;
	directoryMode: number;
	environment: Record<string, string>;
}

let root: string;
let previousEnvironment: NodeJS.ProcessEnv;
const hosts: Host[] = [];
let fixtureDirectory: string;
let fixtureExecutable: string;

beforeAll(async () => {
	fixtureDirectory = await mkdtemp(join(tmpdir(), "plannotator-fixture-"));
	fixtureExecutable = join(
		fixtureDirectory,
		process.platform === "win32" ? "plannotator.exe" : "plannotator",
	);
	const compile = Bun.spawn(
		[
			process.execPath,
			"build",
			"--compile",
			join(import.meta.dir, "fixtures", "plannotator.ts"),
			"--outfile",
			fixtureExecutable,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const output = await new Response(compile.stderr).text();
	if ((await compile.exited) !== 0) throw new Error(`Fixture compilation failed: ${output}`);
}, 120000);

afterAll(async () => {
	await rm(fixtureDirectory, { recursive: true, force: true });
});

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "plannotator-test-"));
	previousEnvironment = { ...process.env };
	for (const key of Object.keys(process.env)) {
		if (key.startsWith("PLANNOTATOR_") || key.startsWith("SSH_")) delete process.env[key];
	}
	// One immutable executable serves isolated working directories; never copy a Bun binary per test.
	process.env.PATH = fixtureDirectory;
});

afterEach(async () => {
	for (const host of hosts.splice(0)) await host.event("session_shutdown");
	for (const key of Object.keys(process.env)) {
		if (!(key in previousEnvironment)) delete process.env[key];
	}
	Object.assign(process.env, previousEnvironment);
	await rm(root, { recursive: true, force: true });
});

async function host(id: string, boundary: Partial<AnnotationBoundary> = {}): Promise<Host> {
	const instance = await createHost(root, id, boundary);
	hosts.push(instance);
	return instance;
}

async function until(condition: () => boolean | Promise<boolean>): Promise<void> {
	await waitUntil(condition, nativeCaseTimeout);
}

async function ready(instance: Host): Promise<RunningReview> {
	const path = join(instance.ctx.cwd, "ready.json");
	await until(() => Bun.file(path).exists());
	return Bun.file(path).json();
}

async function submit(instance: Host, output: unknown): Promise<void> {
	await writeFile(join(instance.ctx.cwd, "result.json"), JSON.stringify(output));
	await until(() => instance.status === undefined);
}

function processExists(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
		throw error;
	}
}

describe("visual annotation", () => {
	test(
		"accepts a real native absolute document path with spaces without modifying it",
		async () => {
			const instance = await host("absolute");
			const target = join(instance.ctx.cwd, "native document with spaces.md");
			await writeFile(target, "# Immutable absolute source\n");
			await instance.command("plannotator-annotate", target);
			const review = await ready(instance);
			expect(review.text).toBe("# Immutable absolute source\n");
			await submit(instance, { decision: "annotated", feedback: "keep it" });
			expect(instance.feedback[0]?.content).toContain(JSON.stringify(target));
			expect(await readFile(target, "utf8")).toBe("# Immutable absolute source\n");
			expect(await Bun.file(review.path).exists()).toBe(false);
		},
		nativeCaseTimeout,
	);

	test(
		"keeps an immutable source identity and delivers one follow-up after branch growth",
		async () => {
			const instance = await host("source");
			const target = "document with spaces.md";
			const original = "# Before\n\nThe reviewed text.\n";
			await writeFile(join(instance.ctx.cwd, target), original);
			process.env.PLANNOTATOR_PORT = "9999";
			process.env.PLANNOTATOR_SHARE = "enabled";
			process.env.PLANNOTATOR_URL_HOST = "tailnet.example";
			process.env.PLANNOTATOR_BROWSER = "/not-a-native-browser";
			process.env.BROWSER = "/not-a-native-browser";
			const preferences = join(root, "preferences with spaces");
			await mkdir(preferences);
			await writeFile(join(preferences, "history.json"), "user-owned history");
			process.env.PLANNOTATOR_DATA_DIR = preferences;
			await instance.command("plannotator-annotate", target);
			const review = await ready(instance);
			expect(review.text).toBe(original);
			if (process.platform !== "win32") {
				expect(review.fileMode).toBe(0o600);
				expect(review.directoryMode).toBe(0o700);
			}
			expect(await readFile(review.path, "utf8")).toBe(original);
			expect(review.environment).toEqual({
				PLANNOTATOR_REMOTE: "0",
				PLANNOTATOR_PORT: "0",
				PLANNOTATOR_SHARE: "disabled",
				PLANNOTATOR_URL_HOST: "",
				PLANNOTATOR_GLIMPSE: "0",
				PLANNOTATOR_DATA_DIR: preferences,
			});
			await instance.command("plannotator-last");
			expect(instance.notices.some(notice => notice.message.includes("/plannotator-cancel"))).toBe(
				true,
			);
			instance.branch.push({
				type: "message",
				id: "later-answer",
				message: {
					role: "assistant",
					stopReason: "stop",
					content: [{ type: "text", text: "Later answer" }],
				},
			});
			await writeFile(join(instance.ctx.cwd, target), "# Changed externally\n");
			const annotations = 'Replace "reviewed text" with "corrected text".\nKeep this excerpt.';
			await submit(instance, { decision: "annotated", feedback: annotations });
			expect(instance.feedback).toHaveLength(1);
			expect(instance.feedback[0]?.content).toContain(annotations);
			expect(instance.feedback[0]?.content).toContain(target);
			expect(instance.feedback[0]?.content).toContain("source-anchor");
			expect(instance.feedback[0]?.content).toContain(
				createHash("sha256").update(original).digest("hex"),
			);
			expect(instance.feedback[0]?.content).toContain("source changed");
			expect(await readFile(join(instance.ctx.cwd, target), "utf8")).toBe("# Changed externally\n");
			expect(await Bun.file(review.path).exists()).toBe(false);
			expect(processExists(review.pid)).toBe(false);
			expect(await readFile(join(preferences, "history.json"), "utf8")).toBe("user-owned history");
			await instance.command("plannotator-cancel");
			expect(instance.feedback).toHaveLength(1);
		},
		nativeCaseTimeout,
	);

	test(
		"selects only completed visible assistant text from the active branch",
		async () => {
			const instance = await host("response");
			instance.branch.push(
				{
					type: "message",
					id: "answer",
					message: {
						role: "assistant",
						stopReason: "stop",
						content: [
							{ type: "thinking" },
							{ type: "text", text: "Visible answer" },
							{ type: "toolCall" },
						],
					},
				},
				{
					type: "custom_message",
					id: "hidden",
					message: { role: "assistant", content: [{ type: "text", text: "Hidden message" }] },
				},
				{
					type: "message",
					id: "tool-result",
					message: { role: "toolResult", content: [{ type: "text", text: "Private tool output" }] },
				},
				{
					type: "message",
					id: "aborted",
					message: {
						role: "assistant",
						stopReason: "aborted",
						content: [{ type: "text", text: "Partial response" }],
					},
				},
			);
			await instance.command("plannotator-last");
			const review = await ready(instance);
			expect(review.text).toBe("Visible answer");
			await submit(instance, { decision: "annotated", feedback: "Explain the answer." });
			expect(instance.feedback[0]?.content).toContain("Assistant response: answer");
			instance.branch = [{ type: "reset_boundary", id: "clear" }];
			await instance.command("plannotator-last");
			await until(() => instance.status === undefined);
			expect(instance.notices.at(-1)?.type).toBe("error");
			expect(instance.feedback).toHaveLength(1);
		},
		nativeCaseTimeout,
	);

	test(
		"cancels owned process groups without delivering a racing result or stopping another session",
		async () => {
			const first = await host("first");
			const second = await host("second");
			await writeFile(join(first.ctx.cwd, "note.md"), "First session");
			await writeFile(join(second.ctx.cwd, "note.md"), "Second session");
			await writeFile(join(first.ctx.cwd, "mode"), "descendant");
			await Promise.all([
				first.command("plannotator-annotate", "note.md"),
				second.command("plannotator-annotate", "note.md"),
			]);
			const [one, two] = await Promise.all([ready(first), ready(second)]);
			expect(one.path).not.toBe(two.path);
			expect(one.text).toBe("First session");
			expect(two.text).toBe("Second session");
			await first.command("plannotator-cancel");
			expect(first.feedback).toEqual([]);
			expect(processExists(one.pid)).toBe(false);
			if (!one.descendant) throw new Error("Fixture did not create its descendant.");
			await until(() => !processExists(one.descendant as number));
			expect(await Bun.file(one.path).exists()).toBe(false);
			expect(processExists(two.pid)).toBe(true);
			await submit(second, { decision: "annotated", feedback: "Second session feedback" });
			expect(second.feedback).toHaveLength(1);
			expect(second.feedback[0]?.content).toContain("Session: second");
			expect(second.feedback[0]?.content).not.toContain("First session");
			expect(await readFile(join(first.ctx.cwd, "note.md"), "utf8")).toBe("First session");
		},
		nativeCaseTimeout,
	);

	test(
		"publishes complete readiness atomically before session-tree cleanup",
		async () => {
			const instance = await host("readiness-publication");
			await writeFile(join(instance.ctx.cwd, "mode"), "staged-ready");
			await writeFile(join(instance.ctx.cwd, "note.md"), "Complete ready snapshot");
			await instance.command("plannotator-annotate", "note.md");
			await until(() => Bun.file(join(instance.ctx.cwd, "ready.pending.json")).exists());
			expect(await Bun.file(join(instance.ctx.cwd, "ready.json")).exists()).toBe(false);
			await writeFile(join(instance.ctx.cwd, "publish-ready"), "publish");
			const review = await ready(instance);
			expect(review.text).toBe("Complete ready snapshot");
			await instance.event("session_before_tree");
			expect(instance.feedback).toEqual([]);
			expect(await Bun.file(review.path).exists()).toBe(false);
			expect(processExists(review.pid)).toBe(false);
		},
		nativeCaseTimeout,
	);

	for (const event of [
		"session_before_switch",
		"session_before_branch",
		"session_before_tree",
		"session_shutdown",
	]) {
		test(
			`${event} suppresses late feedback and removes the snapshot`,
			async () => {
				const instance = await host(event);
				await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
				await instance.command("plannotator-annotate", "note.md");
				const review = await ready(instance);
				await instance.event(event);
				expect(instance.feedback).toEqual([]);
				expect(await Bun.file(review.path).exists()).toBe(false);
				expect(processExists(review.pid)).toBe(false);
			},
			nativeCaseTimeout,
		);
	}

	test(
		"rechecks branch ownership before delivering a result",
		async () => {
			const instance = await host("branch-guard");
			await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
			await instance.command("plannotator-annotate", "note.md");
			const review = await ready(instance);
			instance.branch = [{ type: "message", id: "another-branch" }];
			await submit(instance, { decision: "annotated", feedback: "Old branch feedback" });
			expect(instance.feedback).toEqual([]);
			expect(await Bun.file(review.path).exists()).toBe(false);
		},
		nativeCaseTimeout,
	);

	test(
		"warns when the reviewed source disappears",
		async () => {
			const instance = await host("missing-source");
			const path = join(instance.ctx.cwd, "note.md");
			await writeFile(path, "Review me");
			await instance.command("plannotator-annotate", "note.md");
			await ready(instance);
			await rm(path);
			await submit(instance, { decision: "annotated", feedback: "Keep the reviewed excerpt." });
			expect(instance.feedback).toHaveLength(1);
			expect(instance.feedback[0]?.content).toContain("source is no longer readable");
			expect(await Bun.file(path).exists()).toBe(false);
		},
		nativeCaseTimeout,
	);

	test(
		"cancellation during source preparation prevents launch",
		async () => {
			const instance = await host("preparation");
			await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
			await instance.command("plannotator-annotate", "note.md");
			await instance.command("plannotator-cancel");
			expect(await Bun.file(join(instance.ctx.cwd, "ready.json")).exists()).toBe(false);
			expect(instance.feedback).toEqual([]);
			expect(instance.status).toBeUndefined();
		},
		nativeCaseTimeout,
	);

	test(
		"fails closed on startup errors, malformed output, and an approval decision",
		async () => {
			for (const failure of ["startup-error", "malformed", "approved", "invalid-feedback"]) {
				const instance = await host(failure);
				await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
				await writeFile(join(instance.ctx.cwd, "mode"), failure);
				await instance.command("plannotator-annotate", "note.md");
				const review = await ready(instance);
				if (failure === "malformed") await writeFile(join(instance.ctx.cwd, "result.json"), "not JSON");
				if (failure === "approved") await submit(instance, { decision: "approved", feedback: "Do it" });
				if (failure === "invalid-feedback")
					await submit(instance, { decision: "annotated", feedback: 1 });
				await until(() => instance.status === undefined);
				expect(instance.notices.at(-1)?.type).toBe("error");
				expect(instance.feedback).toEqual([]);
				expect(await Bun.file(review.path).exists()).toBe(false);
			}
		},
		nativeCaseTimeout,
	);

	test(
		"dismissal and empty annotations do not start a model turn",
		async () => {
			for (const decision of [{ decision: "dismissed" }, { decision: "annotated", feedback: " \n" }]) {
				const instance = await host(decision.decision);
				await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
				await instance.command("plannotator-annotate", "note.md");
				const review = await ready(instance);
				await submit(instance, decision);
				expect(instance.feedback).toEqual([]);
				expect(instance.notices.at(-1)?.type).toBe("info");
				expect(await Bun.file(review.path).exists()).toBe(false);
			}
		},
		nativeCaseTimeout,
	);

	test(
		"rejects unavailable documents, unsupported targets, and a missing executable",
		async () => {
			const instance = await host("invalid-input");
			await writeFile(join(instance.ctx.cwd, "binary.txt"), new Uint8Array([255, 0]));
			await writeFile(join(instance.ctx.cwd, "page.html"), "<html></html>");
			for (const target of [
				"missing.md",
				".",
				"binary.txt",
				"page.html",
				"https://example.test/doc",
				"local://note.md",
			]) {
				await instance.command("plannotator-annotate", target);
				await until(() => instance.status === undefined);
				expect(instance.notices.at(-1)?.type).toBe("error");
			}
			await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
			process.env.PATH = instance.ctx.cwd;
			await instance.command("plannotator-annotate", "note.md");
			await until(() => instance.status === undefined);
			expect(instance.notices.at(-1)?.message).toContain("host must supply");
			expect(instance.feedback).toEqual([]);
			expect(await Bun.file(join(instance.ctx.cwd, "ready.json")).exists()).toBe(false);
		},
		nativeCaseTimeout,
	);

	test(
		"rejects noninteractive and remote invocation before launch",
		async () => {
			const instance = await host("nonlocal");
			await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
			instance.ctx.mode = "rpc";
			await instance.command("plannotator-annotate", "note.md");
			expect(instance.notices.at(-1)?.type).toBe("error");
			instance.ctx.mode = "tui";
			process.env.SSH_CONNECTION = "192.0.2.1 1 192.0.2.2 2";
			await instance.command("plannotator-annotate", "note.md");
			expect(instance.notices.at(-1)?.type).toBe("error");
			expect(instance.status).toBeUndefined();
			expect(await Bun.file(join(instance.ctx.cwd, "ready.json")).exists()).toBe(false);
			expect(instance.feedback).toEqual([]);
		},
		nativeCaseTimeout,
	);
});
