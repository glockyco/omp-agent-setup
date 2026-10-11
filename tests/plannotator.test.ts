import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	setDefaultTimeout,
	test,
} from "bun:test";
import type { ChildProcessByStdio } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, type Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@oh-my-pi/pi-coding-agent";
import type { AnnotationBoundary } from "../plugin/extensions/plannotator";

// Real Windows CIM/termination utilities and compiled fixtures are external processes.
setDefaultTimeout(60000);
const pluginRoot = process.env.PERSONAL_PLUGIN_DIR ?? join(import.meta.dir, "..", "plugin");
// Exercise the manifest payload selected by the source run or the installed-release check.
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
	plannotator(
		{
			registerCommand: (name: string, options: { handler: Handler }) => {
				commands.set(name, options.handler);
			},
			on: (name: string, handler: EventHandler) => {
				events.set(name, handler);
			},
			sendMessage: (message: { content: string }) => {
				feedback.push({ content: message.content });
			},
		} as unknown as ExtensionAPI,
		boundary,
	);
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

function processDouble(platform: NodeJS.Platform = "win32") {
	const child = Object.assign(new EventEmitter(), {
		pid: 101,
		stdout: new PassThrough(),
		stderr: new PassThrough(),
	});
	const rootIdentity = { pid: 101, parentPid: 1, created: "2026-10-11T01:00:00.0000000Z" };
	const descendant = { pid: 102, parentPid: 101, created: "2026-10-11T01:00:01.0000000Z" };
	let identities = [
		rootIdentity,
		descendant,
		{ pid: 999, parentPid: 1, created: descendant.created },
	];
	const requests: Array<{ pid: number; force: boolean }> = [];
	const signals: Array<{ pid: number; signal: NodeJS.Signals }> = [];
	const grace = Promise.withResolvers<void>();
	const inspected = Promise.withResolvers<void>();
	let queries = 0;
	let snapshot = "";
	let waiting = false;
	let closeCount = 0;
	let queryError = false;
	let utilityError = false;
	let forcedError = false;
	let spawnOptions: Parameters<AnnotationBoundary["spawn"]>[2] | undefined;
	let argv: string[] = [];
	function close() {
		if (closeCount++) return;
		child.stdout.end();
		child.stderr.end();
		child.emit("close", 0);
	}
	const boundary: Partial<AnnotationBoundary> = {
		platform,
		environment: () => ({}),
		spawn: (command, args, options) => {
			expect(command).toBe("plannotator");
			argv = args;
			snapshot = args[1] ?? "";
			spawnOptions = options;
			return child as unknown as ChildProcessByStdio<null, Readable, Readable>;
		},
		processes: async () => {
			if (queryError) throw new Error("CIM denied");
			if (++queries >= 2) inspected.resolve();
			return identities.map(identity => ({ ...identity }));
		},
		taskkill: async (pid, force) => {
			requests.push({ pid, force });
			expect(await Bun.file(snapshot).exists()).toBe(true);
			if (utilityError) return { code: 5, output: "Access is denied." };
			if (forcedError && force) return { code: 5, output: "Force denied." };
			if (!force) {
				identities = identities.filter(identity => identity.pid !== 101);
				child.emit("exit", 0);
				return {
					code: 128,
					output: "This process can only be terminated forcefully (with /F option).",
				};
			}
			identities = identities.filter(identity => identity.pid !== pid);
			close();
			return { code: 0, output: "terminated" };
		},
		kill: (pid, signal) => {
			signals.push({ pid, signal });
			if (signal === "SIGKILL") close();
		},
		sleep: async milliseconds => {
			expect(milliseconds).toBe(1000);
			waiting = true;
			await grace.promise;
		},
	};
	return {
		boundary,
		child,
		requests,
		signals,
		grace,
		inspected,
		close,
		get waiting() {
			return waiting;
		},
		get snapshot() {
			return snapshot;
		},
		get options() {
			return spawnOptions;
		},
		get argv() {
			return argv;
		},
		get identities() {
			return identities;
		},
		set identities(value) {
			identities = value;
		},
		set queryError(value: boolean) {
			queryError = value;
		},
		set utilityError(value: boolean) {
			utilityError = value;
		},
		set forcedError(value: boolean) {
			forcedError = value;
		},
	};
}

describe("injected annotation process boundary", () => {
	for (const platform of ["linux", "darwin", "win32"] as const) {
		test(`${platform} refuses all remote/noninteractive cases before reading or spawning`, async () => {
			for (const refusal of [
				"rpc",
				"no-ui",
				"SSH_CONNECTION",
				"SSH_CLIENT",
				"SSH_TTY",
				"PLANNOTATOR_REMOTE",
			]) {
				let reads = 0;
				let spawns = 0;
				const instance = await host(`${platform}-${refusal}`, {
					platform,
					environment: () => (refusal === "rpc" || refusal === "no-ui" ? {} : { [refusal]: "true" }),
					readDocument: async () => {
						reads++;
						return new TextEncoder().encode("text");
					},
					spawn: () => {
						spawns++;
						throw new Error("Unexpected spawn");
					},
				});
				if (refusal === "rpc") instance.ctx.mode = "rpc";
				if (refusal === "no-ui") instance.ctx.hasUI = false;
				await instance.command("plannotator-annotate", "unavailable.md");
				expect(instance.notices.at(-1)?.message).toContain(
					refusal === "rpc" || refusal === "no-ui"
						? "local interactive OMP session."
						: "remote sessions.",
				);
				expect(reads).toBe(0);
				expect(spawns).toBe(0);
				expect(instance.status).toBeUndefined();
			}
		});

		test(`${platform} uses exact native argv/spawn options and once-only owned cleanup`, async () => {
			const double = processDouble(platform);
			const instance = await host(`spawn-${platform}`, double.boundary);
			await writeFile(join(instance.ctx.cwd, "note.md"), "review");
			await instance.command("plannotator-annotate", "note.md");
			await until(() => !!double.snapshot);
			expect(double.argv).toEqual(["annotate", double.snapshot, "--json"]);
			expect(double.options).toEqual({
				cwd: instance.ctx.cwd,
				env: {
					PLANNOTATOR_REMOTE: "0",
					PLANNOTATOR_PORT: "0",
					PLANNOTATOR_SHARE: "disabled",
					PLANNOTATOR_URL_HOST: "",
					PLANNOTATOR_GLIMPSE: "0",
				},
				detached: platform !== "win32",
				windowsHide: platform === "win32",
				stdio: ["ignore", "pipe", "pipe"],
			});
			const cancellation = Promise.all([
				instance.command("plannotator-cancel"),
				instance.command("plannotator-cancel"),
			]);
			await until(() => double.waiting);
			expect(await Bun.file(double.snapshot).exists()).toBe(true);
			double.child.stdout.write(JSON.stringify({ decision: "annotated", feedback: "late" }));
			double.grace.resolve();
			await cancellation;
			if (platform === "win32")
				expect(double.requests).toEqual([
					{ pid: 101, force: false },
					{ pid: 102, force: true },
				]);
			else
				expect(double.signals).toEqual([
					{ pid: -101, signal: "SIGTERM" },
					{ pid: -101, signal: "SIGKILL" },
				]);
			expect(instance.feedback).toEqual([]);
			expect(await Bun.file(double.snapshot).exists()).toBe(false);
			expect(double.identities.some(identity => identity.pid === 999)).toBe(true);
		});
	}

	test("retains snapshots until stream close even when the owned tree is absent", async () => {
		const double = processDouble();
		double.identities = [];
		const instance = await host("absent", double.boundary);
		await writeFile(join(instance.ctx.cwd, "note.md"), "review");
		await instance.command("plannotator-annotate", "note.md");
		await until(() => !!double.snapshot);
		let cancelled = false;
		const cancellation = instance.command("plannotator-cancel").then(() => {
			cancelled = true;
		});
		await double.inspected.promise;
		expect(cancelled).toBe(false);
		expect(await Bun.file(double.snapshot).exists()).toBe(true);
		double.close();
		await cancellation;
		expect(double.requests).toEqual([]);
		expect(await Bun.file(double.snapshot).exists()).toBe(false);
	});

	test("never escalates to a reused descendant PID", async () => {
		const double = processDouble();
		const instance = await host("reuse", double.boundary);
		await writeFile(join(instance.ctx.cwd, "note.md"), "review");
		await instance.command("plannotator-annotate", "note.md");
		await until(() => !!double.snapshot);
		const cancellation = instance.command("plannotator-cancel");
		await until(() => double.waiting);
		double.identities = double.identities.map(identity =>
			identity.pid === 102 ? { ...identity, created: "2026-10-11T02:00:00.0000000Z" } : identity,
		);
		double.close();
		double.grace.resolve();
		await cancellation;
		expect(double.requests).toEqual([{ pid: 101, force: false }]);
	});

	test("never discovers or kills descendants below a reused root PID", async () => {
		const double = processDouble();
		const instance = await host("root-reuse", double.boundary);
		await writeFile(join(instance.ctx.cwd, "note.md"), "review");
		await instance.command("plannotator-annotate", "note.md");
		await until(() => !!double.snapshot);
		double.identities = [
			{ pid: 101, parentPid: 1, created: "2026-10-11T02:00:00.0000000Z" },
			{ pid: 777, parentPid: 101, created: "2026-10-11T02:00:01.0000000Z" },
		];
		const cancellation = instance.command("plannotator-cancel");
		await double.inspected.promise;
		double.close();
		await cancellation;
		expect(double.requests).toEqual([]);
		expect(double.identities.map(identity => identity.pid)).toEqual([101, 777]);
	});

	test("startup error waits for stream close before removing the snapshot", async () => {
		const double = processDouble();
		double.identities = [];
		const instance = await host("spawn-error", double.boundary);
		await writeFile(join(instance.ctx.cwd, "note.md"), "review");
		await instance.command("plannotator-annotate", "note.md");
		await until(() => !!double.snapshot);
		double.child.emit("error", Object.assign(new Error("not found"), { code: "ENOENT" }));
		await double.inspected.promise;
		expect(await Bun.file(double.snapshot).exists()).toBe(true);
		double.close();
		await until(() => instance.status === undefined);
		expect(instance.notices.at(-1)?.message).toContain("host must supply");
		expect(await Bun.file(double.snapshot).exists()).toBe(false);
	});

	for (const failure of ["query", "utility", "force", "mixed"] as const) {
		test(`${failure} failures remain visible without claiming cleanup or deleting snapshots`, async () => {
			const double = processDouble();
			if (failure === "mixed")
				double.boundary.taskkill = async () => ({
					code: 128,
					output:
						"Reason: This process can only be terminated forcefully.\nReason: unknown utility error",
				});
			const instance = await host(`failure-${failure}`, double.boundary);
			await writeFile(join(instance.ctx.cwd, "note.md"), "review");
			await instance.command("plannotator-annotate", "note.md");
			await until(() => !!double.snapshot);
			if (failure === "query") double.queryError = true;
			if (failure === "utility") double.utilityError = true;
			if (failure === "force") double.forcedError = true;
			double.grace.resolve();
			await instance.command("plannotator-cancel");
			expect(instance.notices.at(-1)?.message).toContain("cleanup failed");
			expect(instance.notices.some(notice => notice.message === "Plannotator review cancelled.")).toBe(
				false,
			);
			expect(await Bun.file(double.snapshot).exists()).toBe(true);
			expect(instance.feedback).toEqual([]);
			double.close();
			await until(() => instance.status === undefined);
			await rm(join(double.snapshot, ".."), { recursive: true, force: true });
		});
	}

	test("session-local mapping captures each instance's native identity before asynchronous resolution", async () => {
		const mapping = Promise.withResolvers<void>();
		const one = processDouble();
		const two = processDouble();
		const observed: string[] = [];
		const instances: Host[] = [];
		for (const [id, double] of [
			["local-one", one],
			["local-two", two],
		] as const) {
			const instance = await host(id, {
				...double.boundary,
				resolveLocal: async (target, cwd, artifactsDir, sessionId) => {
					expect(target).toBe("local://note.md");
					expect(artifactsDir).toBe(cwd);
					observed.push(sessionId ?? "");
					await mapping.promise;
					return join(cwd, "note.md");
				},
			});
			await writeFile(join(instance.ctx.cwd, "note.md"), id);
			instance.ctx.localProtocolOptions = {
				getArtifactsDir: () => instance.ctx.cwd,
				getSessionId: () => id,
			};
			instances.push(instance);
			await instance.command("plannotator-annotate", "local://note.md");
		}
		// Changing the live mapping cannot change the identity already captured for either review.
		for (const instance of instances)
			instance.ctx.localProtocolOptions = { getSessionId: () => "later" };
		mapping.resolve();
		await until(() => !!one.snapshot && !!two.snapshot);
		expect(observed).toEqual(["local-one", "local-two"]);
		expect(await Bun.file(one.snapshot).text()).toBe("local-one");
		expect(await Bun.file(two.snapshot).text()).toBe("local-two");
		const first = instances[0];
		const second = instances[1];
		if (!first || !second) throw new Error("Missing independent instances");
		const cancellation = first.command("plannotator-cancel");
		one.grace.resolve();
		await cancellation;
		expect(await Bun.file(two.snapshot).exists()).toBe(true);
		two.identities = [];
		two.child.stdout.write(
			JSON.stringify({ decision: "annotated", feedback: "second local feedback" }),
		);
		two.close();
		await until(() => second.status === undefined);
		expect(first.feedback).toEqual([]);
		expect(second.feedback[0]?.content).toContain('Document: "local://note.md"');
		expect(second.feedback[0]?.content).toContain("local-two");
	});

	for (const target of [
		"C:\\documents with spaces\\note.md",
		"\\\\server\\share\\documents with spaces\\note.md",
	]) {
		test(`classifies ${target} as a filesystem path without changing captured identity`, async () => {
			const double = processDouble();
			let observed = "";
			const instance = await host(`path-${target.startsWith("C:") ? "drive" : "unc"}`, {
				...double.boundary,
				readDocument: async path => {
					observed = path;
					return new TextEncoder().encode("immutable");
				},
			});
			await instance.command("plannotator-annotate", target);
			await until(() => !!double.snapshot);
			expect(observed).toBe(target);
			expect(await Bun.file(double.snapshot).text()).toBe("immutable");
			double.identities = [];
			double.child.stdout.write(JSON.stringify({ decision: "annotated", feedback: "comment" }));
			double.close();
			await until(() => instance.status === undefined);
			expect(instance.feedback[0]?.content).toContain(JSON.stringify(target));
		});
	}
});

describe("visual annotation", () => {
	test("accepts a real native absolute document path with spaces without modifying it", async () => {
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
	});

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
		expect(instance.notices.at(-1)?.message).toContain("host must supply");
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
