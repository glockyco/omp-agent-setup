import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ChildProcessByStdio } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, type Readable } from "node:stream";
import type { AnnotationBoundary } from "../plugin/extensions/plannotator";
import { createHost, type Host, until as waitUntil } from "./fixtures/plannotator-harness";

let root: string;
let previousEnvironment: NodeJS.ProcessEnv;
const hosts: Host[] = [];

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "plannotator-unit-test-"));
	previousEnvironment = { ...process.env };
	for (const key of Object.keys(process.env)) {
		if (key.startsWith("PLANNOTATOR_") || key.startsWith("SSH_")) delete process.env[key];
	}
	// Every process operation is injected; no compiled fixture or process utility is needed.
	process.env.PATH = root;
});

afterEach(async () => {
	for (const host of hosts.splice(0)) await host.event("session_shutdown");
	for (const key of Object.keys(process.env)) {
		if (!(key in previousEnvironment)) delete process.env[key];
	}
	Object.assign(process.env, previousEnvironment);
	await rm(root, { recursive: true, force: true });
});

async function host(id: string, boundary: Partial<AnnotationBoundary>): Promise<Host> {
	const instance = await createHost(root, id, boundary);
	hosts.push(instance);
	return instance;
}

async function until(condition: () => boolean | Promise<boolean>): Promise<void> {
	await waitUntil(condition, 5000);
}

function processDouble(platform: NodeJS.Platform = "win32") {
	const child = Object.assign(new EventEmitter(), {
		pid: 101,
		exitCode: null as number | null,
		signalCode: null as NodeJS.Signals | null,
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
		child.exitCode = 0;
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

	test.each(["SIGTERM", "SIGKILL"] as const)(
		"Darwin retries %s only after the owned root is reaped and accepts a gone group",
		async racedSignal => {
			const double = processDouble("darwin");
			let refused = false;
			const sleeps: number[] = [];
			double.boundary.kill = (pid, signal) => {
				double.signals.push({ pid, signal });
				if (signal !== racedSignal) return;
				if (!refused) {
					refused = true;
					throw Object.assign(new Error("Darwin zombie group"), { code: "EPERM" });
				}
				throw Object.assign(new Error("gone"), { code: "ESRCH" });
			};
			double.boundary.sleep = async milliseconds => {
				sleeps.push(milliseconds);
				if (milliseconds === 0) double.close();
			};
			const instance = await host(`darwin-reap-${racedSignal}`, double.boundary);
			await writeFile(join(instance.ctx.cwd, "note.md"), "review");
			await instance.command("plannotator-annotate", "note.md");
			await until(() => !!double.snapshot);
			await Promise.all([
				instance.command("plannotator-cancel"),
				instance.command("plannotator-cancel"),
			]);
			expect(sleeps).toEqual(racedSignal === "SIGTERM" ? [0] : [1000, 0]);
			expect(double.signals).toEqual([
				...(racedSignal === "SIGKILL" ? [{ pid: -101, signal: "SIGTERM" as const }] : []),
				{ pid: -101, signal: racedSignal },
				{ pid: -101, signal: racedSignal },
			]);
			expect(instance.notices.some(notice => notice.type === "error")).toBe(false);
			expect(instance.feedback).toEqual([]);
			expect(await Bun.file(double.snapshot).exists()).toBe(false);
		},
	);

	test.each(["live-root", "exited-root"] as const)(
		"Darwin permission failure with %s and live group members stays visible",
		async state => {
			const double = processDouble("darwin");
			double.boundary.kill = (pid, signal) => {
				double.signals.push({ pid, signal });
				throw Object.assign(new Error("Darwin group denied"), { code: "EPERM" });
			};
			double.boundary.sleep = async milliseconds => {
				expect(milliseconds).toBe(0);
				if (state === "exited-root") double.child.exitCode = 0;
			};
			const instance = await host(`darwin-denied-${state}`, double.boundary);
			await writeFile(join(instance.ctx.cwd, "note.md"), "review");
			await instance.command("plannotator-annotate", "note.md");
			await until(() => !!double.snapshot);
			await instance.command("plannotator-cancel");
			expect(double.signals).toHaveLength(state === "live-root" ? 1 : 2);
			expect(instance.notices.at(-1)?.message).toContain("Darwin group denied");
			expect(await Bun.file(double.snapshot).exists()).toBe(true);
			expect(instance.feedback).toEqual([]);
			double.close();
			await until(() => instance.status === undefined);
			await rm(join(double.snapshot, ".."), { recursive: true, force: true });
		},
	);

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
