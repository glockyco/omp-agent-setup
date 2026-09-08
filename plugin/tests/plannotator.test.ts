import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@oh-my-pi/pi-coding-agent";

const pluginRoot = process.env.PERSONAL_PLUGIN_DIR ?? join(import.meta.dir, "..");
// Exercise the manifest payload selected by the source or Nix check.
const { default: plannotator } = await import(
	pathToFileURL(join(pluginRoot, "extensions/plannotator.ts")).href
);

type Handler = (args: string, ctx: ExtensionContext) => Promise<void>;
type EventHandler = (event: { type: string }, ctx: ExtensionContext) => Promise<void>;
interface Host {
	ctx: ExtensionContext;
	branch: SessionEntry[];
	notices: Array<{ message: string; type?: string }>;
	feedback: Array<{ content: string }>;
	status?: string;
	command(name: string, args?: string): Promise<void>;
	event(name: string): Promise<void>;
}
interface RunningReview {
	pid: number;
	descendant?: number;
	path: string;
	text: string;
	fileMode: number;
	directoryMode: number;
}

let root: string;
let previousEnvironment: NodeJS.ProcessEnv;
const hosts: Host[] = [];

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "plannotator-test-"));
	previousEnvironment = { ...process.env };
	for (const key of Object.keys(process.env)) {
		if (key.startsWith("PLANNOTATOR_") || key.startsWith("SSH_")) delete process.env[key];
	}
	const bin = join(root, "bin");
	await mkdir(bin);
	const executable = join(bin, "plannotator");
	await writeFile(
		executable,
		`#!${process.execPath}
import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { dirname } from "node:path";
const path = process.argv[3];
const mode = await Bun.file("mode").text().catch(() => "normal");
let descendant;
if (mode === "descendant") {
  const child = spawn(process.execPath, ["-e", 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);'], { stdio: "ignore" });
  descendant = child.pid;
}
process.on("SIGTERM", () => {
  console.log(JSON.stringify({ decision: "annotated", feedback: "Late cancellation feedback" }));
  process.exit(0);
});
await Bun.write("ready.json", JSON.stringify({
  pid: process.pid, descendant, path, text: await Bun.file(path).text(),
  fileMode: statSync(path).mode & 0o777, directoryMode: statSync(dirname(path)).mode & 0o777,
}));
if (mode === "startup-error") { console.error("fixture startup failure"); process.exit(2); }
while (!(await Bun.file("result.json").exists())) await Bun.sleep(10);
process.stdout.write(await Bun.file("result.json").text());
`,
		{ mode: 0o700 },
	);
	await chmod(executable, 0o700);
	process.env.PATH = bin;
});

afterEach(async () => {
	for (const host of hosts.splice(0)) await host.event("session_shutdown");
	for (const key of Object.keys(process.env)) {
		if (!(key in previousEnvironment)) delete process.env[key];
	}
	Object.assign(process.env, previousEnvironment);
	await rm(root, { recursive: true, force: true });
});

async function host(id: string): Promise<Host> {
	const cwd = join(root, id);
	await mkdir(cwd);
	const commands = new Map<string, Handler>();
	const events = new Map<string, EventHandler>();
	const branch: SessionEntry[] = [
		{
			type: "message",
			id: `${id}-anchor`,
			message: { role: "user", content: [{ type: "text", text: "Question" }] },
		},
	];
	const notices: Host["notices"] = [];
	const feedback: Host["feedback"] = [];
	const instance: Host = {
		branch,
		notices,
		feedback,
		ctx: {
			cwd,
			mode: "tui",
			hasUI: true,
			ui: {
				notify: (message, type) => {
					notices.push({ message, type });
				},
				setStatus: (_key, text) => {
					instance.status = text;
				},
			},
			sessionManager: {
				getCwd: () => cwd,
				getSessionDir: () => cwd,
				getSessionId: () => id,
				getArtifactsDir: () => null,
				getLeafId: () => instance.branch.at(-1)?.id ?? null,
				getBranch: () => instance.branch,
			},
		},
		command: async (name, args = "") => {
			const handler = commands.get(name);
			if (!handler) throw new Error(`Command not registered: ${name}`);
			await handler(args, instance.ctx);
		},
		event: async name => {
			const handler = events.get(name);
			if (!handler) throw new Error(`Event not registered: ${name}`);
			await handler({ type: name }, instance.ctx);
		},
	};
	plannotator({
		registerCommand: (name: string, options: { handler: Handler }) => {
			commands.set(name, options.handler);
		},
		on: (name: string, handler: EventHandler) => {
			events.set(name, handler);
		},
		sendMessage: (message: { content: string }) => {
			feedback.push({ content: message.content });
		},
	} as unknown as ExtensionAPI);
	hosts.push(instance);
	return instance;
}

async function until(condition: () => boolean | Promise<boolean>): Promise<void> {
	const deadline = Date.now() + 5000;
	while (!(await condition())) {
		if (Date.now() > deadline) throw new Error("Timed out waiting for annotation state.");
		await Bun.sleep(10);
	}
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
	test("keeps an immutable source identity and delivers one follow-up after branch growth", async () => {
		const instance = await host("source");
		const target = "document with spaces.md";
		const original = "# Before\n\nThe reviewed text.\n";
		await writeFile(join(instance.ctx.cwd, target), original);
		process.env.PLANNOTATOR_PORT = "9999";
		process.env.PLANNOTATOR_SHARE = "enabled";
		process.env.PLANNOTATOR_URL_HOST = "tailnet.example";
		process.env.PLANNOTATOR_BROWSER = "/not-a-native-browser";
		process.env.BROWSER = "/not-a-native-browser";
		await instance.command("plannotator-annotate", target);
		const review = await ready(instance);
		expect(review.text).toBe(original);
		expect(review.fileMode).toBe(0o600);
		expect(review.directoryMode).toBe(0o700);
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
		await instance.command("plannotator-cancel");
		expect(instance.feedback).toHaveLength(1);
	});

	test("selects only completed visible assistant text from the active branch", async () => {
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
	});

	test("cancels owned process groups without delivering a racing result or stopping another session", async () => {
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
	});

	for (const event of [
		"session_before_switch",
		"session_before_branch",
		"session_before_tree",
		"session_shutdown",
	]) {
		test(`${event} suppresses late feedback and removes the snapshot`, async () => {
			const instance = await host(event);
			await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
			await instance.command("plannotator-annotate", "note.md");
			const review = await ready(instance);
			await instance.event(event);
			expect(instance.feedback).toEqual([]);
			expect(await Bun.file(review.path).exists()).toBe(false);
			expect(processExists(review.pid)).toBe(false);
		});
	}

	test("rechecks branch ownership before delivering a result", async () => {
		const instance = await host("branch-guard");
		await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
		await instance.command("plannotator-annotate", "note.md");
		const review = await ready(instance);
		instance.branch = [{ type: "message", id: "another-branch" }];
		await submit(instance, { decision: "annotated", feedback: "Old branch feedback" });
		expect(instance.feedback).toEqual([]);
		expect(await Bun.file(review.path).exists()).toBe(false);
	});

	test("warns when the reviewed source disappears", async () => {
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
	});

	test("cancellation during source preparation prevents launch", async () => {
		const instance = await host("preparation");
		await writeFile(join(instance.ctx.cwd, "note.md"), "Review me");
		await instance.command("plannotator-annotate", "note.md");
		await instance.command("plannotator-cancel");
		expect(await Bun.file(join(instance.ctx.cwd, "ready.json")).exists()).toBe(false);
		expect(instance.feedback).toEqual([]);
		expect(instance.status).toBeUndefined();
	});

	test("fails closed on startup errors, malformed output, and an approval decision", async () => {
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
	});

	test("dismissal and empty annotations do not start a model turn", async () => {
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
	});

	test("rejects unavailable documents, unsupported targets, and a missing executable", async () => {
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
		expect(instance.notices.at(-1)?.message).toContain("managed OMP wrapper");
		expect(instance.feedback).toEqual([]);
		expect(await Bun.file(join(instance.ctx.cwd, "ready.json")).exists()).toBe(false);
	});

	test("rejects noninteractive and remote invocation before launch", async () => {
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
	});
});
