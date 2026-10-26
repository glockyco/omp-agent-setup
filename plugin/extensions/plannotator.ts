import { isUtf8 } from "node:buffer";
import { type ChildProcessByStdio, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import type { Readable } from "node:stream";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const STATUS_KEY = "plannotator";
const UNSUPPORTED_EXTENSIONS: Record<string, true> = {
	".7z": true,
	".avi": true,
	".bmp": true,
	".bz2": true,
	".db": true,
	".doc": true,
	".docx": true,
	".gif": true,
	".gz": true,
	".htm": true,
	".html": true,
	".ico": true,
	".jpeg": true,
	".jpg": true,
	".mov": true,
	".mp3": true,
	".mp4": true,
	".pdf": true,
	".png": true,
	".ppt": true,
	".pptx": true,
	".rar": true,
	".sqlite": true,
	".svg": true,
	".tar": true,
	".webm": true,
	".webp": true,
	".xhtml": true,
	".xls": true,
	".xlsx": true,
	".xz": true,
	".zip": true,
};

interface Snapshot {
	identity: string;
	bytes: Uint8Array;
	hash: string;
	path?: string;
}

interface Review {
	sessionId: string;
	anchor: string | null;
	label: string;
	cancelled: boolean;
	settled: boolean;
	done: Promise<void>;
	child?: AnnotationChild;
}

interface AnnotationChild {
	result: Promise<{ code: number | null; stdout: string; stderr: string }>;
	stop(): Promise<void>;
}

interface ProcessIdentity {
	pid: number;
	parentPid: number;
	created: string;
}

export interface AnnotationBoundary {
	platform: NodeJS.Platform;
	environment(): NodeJS.ProcessEnv;
	spawn: (
		command: string,
		args: string[],
		options: {
			cwd?: string;
			env?: NodeJS.ProcessEnv;
			detached: boolean;
			windowsHide: boolean;
			stdio: ["ignore", "pipe", "pipe"];
		},
	) => ChildProcessByStdio<null, Readable, Readable>;
	kill(pid: number, signal: NodeJS.Signals): void;
	sleep(milliseconds: number): Promise<void>;
	processes(): Promise<ProcessIdentity[]>;
	taskkill(pid: number, force: boolean): Promise<{ code: number | null; output: string }>;
	readDocument(path: string): Promise<Uint8Array>;
	resolveLocal(
		target: string,
		cwd: string,
		artifactsDir: string | null,
		sessionId: string | null,
	): Promise<string | null>;
}

async function utility(
	command: string,
	args: string[],
): Promise<{ code: number | null; output: string }> {
	const child = spawn(command, args, {
		windowsHide: true,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	for (const stream of [child.stdout, child.stderr]) {
		stream.setEncoding("utf8");
		stream.on("data", (chunk: string) => {
			output += chunk;
		});
	}
	const {
		promise,
		resolve: resolveUtility,
		reject,
	} = Promise.withResolvers<{ code: number | null; output: string }>();
	child.once("error", reject);
	child.once("close", code => resolveUtility({ code, output }));
	return promise;
}

async function windowsProcesses(): Promise<ProcessIdentity[]> {
	const system = process.env.SystemRoot ?? "C:\\Windows";
	const result = await utility(
		join(system, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
		[
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			"$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; @(Get-CimInstance Win32_Process | Select-Object @{n='pid';e={$_.ProcessId}},@{n='parentPid';e={$_.ParentProcessId}},@{n='created';e={$_.CreationDate.ToUniversalTime().ToString('o')}}) | ConvertTo-Json -Compress",
		],
	);
	if (result.code !== 0)
		throw new Error(`Windows process inspection failed: ${result.output.trim()}`);
	const identities: unknown = JSON.parse(result.output.replace(/^\uFEFF/u, ""));
	if (
		!Array.isArray(identities) ||
		identities.some(
			item =>
				!item ||
				!Number.isInteger(item.pid) ||
				!Number.isInteger(item.parentPid) ||
				typeof item.created !== "string",
		)
	)
		throw new Error("Windows process inspection returned invalid identities.");
	return identities;
}

function defaultBoundary(): AnnotationBoundary {
	return {
		platform: process.platform,
		environment: () => process.env,
		spawn,
		kill: (pid, signal) => process.kill(pid, signal),
		sleep: milliseconds => {
			const { promise, resolve: resolveSleep } = Promise.withResolvers<void>();
			setTimeout(resolveSleep, milliseconds);
			return promise;
		},
		processes: windowsProcesses,
		taskkill: (pid, force) =>
			utility(join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"), [
				"/PID",
				String(pid),
				...(force ? ["/F"] : []),
			]),
		readDocument: readDocumentBytes,
		resolveLocal: async (target, cwd, artifactsDir, sessionId) => {
			// This host-only module is absent during standalone payload discovery.
			const { resolveLocalUrlToFile } = await import(
				"@oh-my-pi/pi-coding-agent/internal-urls/local-protocol"
			);
			const file = await resolveLocalUrlToFile(target, {
				cwd,
				localProtocolOptions: {
					getArtifactsDir: () => artifactsDir,
					getSessionId: () => sessionId,
				},
			});
			return file?.path ?? null;
		},
	};
}

function ownedTree(root: ProcessIdentity, processes: ProcessIdentity[]): ProcessIdentity[] {
	const owned = [root];
	for (let index = 0; index < owned.length; index++) {
		const parent = owned[index];
		if (!parent) continue;
		for (const candidate of processes) {
			if (
				candidate.parentPid === parent.pid &&
				candidate.created >= parent.created &&
				!owned.some(identity => identity.pid === candidate.pid)
			)
				owned.push(candidate);
		}
	}
	return owned;
}

function surviving(owned: ProcessIdentity[], processes: ProcessIdentity[]): ProcessIdentity[] {
	return owned.filter(identity =>
		processes.some(current => current.pid === identity.pid && current.created === identity.created),
	);
}

function hash(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function localEnvironment(ctx: ExtensionContext, boundary: AnnotationBoundary): NodeJS.ProcessEnv {
	if (ctx.mode !== "tui" || !ctx.hasUI) {
		throw new Error("Plannotator requires a local interactive OMP session.");
	}
	const inherited = boundary.environment();
	if (
		inherited.SSH_CONNECTION ||
		inherited.SSH_CLIENT ||
		inherited.SSH_TTY ||
		/^(1|true)$/iu.test(inherited.PLANNOTATOR_REMOTE ?? "")
	) {
		throw new Error("Plannotator annotation is unavailable in remote sessions.");
	}
	const env = { ...inherited };
	for (const key of Object.keys(env)) {
		if (key.startsWith("PLANNOTATOR_") && key !== "PLANNOTATOR_DATA_DIR") delete env[key];
	}
	delete env.BROWSER;
	return {
		...env,
		PLANNOTATOR_REMOTE: "0",
		PLANNOTATOR_PORT: "0",
		PLANNOTATOR_SHARE: "disabled",
		PLANNOTATOR_URL_HOST: "",
		PLANNOTATOR_GLIMPSE: "0",
	};
}

async function readDocumentBytes(path: string): Promise<Uint8Array> {
	const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
	try {
		if (!(await file.stat()).isFile()) throw new Error("The target is not a regular document file.");
		return await file.readFile();
	} finally {
		await file.close();
	}
}

async function documentSnapshot(
	target: string,
	ctx: ExtensionContext,
	boundary: AnnotationBoundary,
): Promise<Snapshot> {
	let path: string;
	if (target.startsWith("local://")) {
		const options = ctx.localProtocolOptions;
		if (!options) throw new Error("This session has no native local:// mapping.");
		const artifactsDir = options.getArtifactsDir?.() ?? null;
		const sessionId = options.getSessionId?.() ?? null;
		if (!artifactsDir && !sessionId) throw new Error("This session has no native local:// identity.");
		const file = await boundary.resolveLocal(target, ctx.cwd, artifactsDir, sessionId);
		if (!file) throw new Error("The local:// target is not a document in this session.");
		path = file;
	} else {
		const nativeWindowsPath = /^(?:[a-z]:[\\/]|\\\\[^\\]+\\[^\\]+(?:\\|$))/iu.test(target);
		if (!nativeWindowsPath && /^[a-z][a-z\d+.-]*:/iu.test(target)) {
			throw new Error("Unsupported target scheme. Use a filesystem path or local:// document.");
		}
		path = nativeWindowsPath ? target : resolve(ctx.cwd, target);
	}
	if (UNSUPPORTED_EXTENSIONS[extname(path).toLowerCase()]) {
		throw new Error(
			"Unsupported document. Use a UTF-8 text or Markdown file, not HTML or binary data.",
		);
	}
	const bytes = await boundary.readDocument(path);
	if (!isUtf8(bytes)) throw new Error("The document is not valid UTF-8 text.");
	if (bytes.some(byte => byte < 9 || (byte > 13 && byte < 32))) {
		throw new Error("The document contains binary control characters.");
	}
	return {
		identity: `Document: ${JSON.stringify(target)}\nResolved path: ${JSON.stringify(path)}`,
		bytes,
		hash: hash(bytes),
		path,
	};
}

function responseSnapshot(ctx: ExtensionContext): Snapshot {
	const branch = ctx.sessionManager.getBranch();
	for (let index = branch.length - 1; index >= 0; index--) {
		const entry = branch[index];
		if (!entry || entry.type === "reset_boundary") break;
		if (entry.type !== "message" || entry.message?.role !== "assistant") continue;
		const message = entry.message;
		if (message.stopReason !== "stop" && message.stopReason !== "length") continue;
		const text = message.content
			.filter((block): block is { type: "text"; text: string } => block.type === "text")
			.map(block => block.text)
			.join("\n\n");
		if (!text.trim()) continue;
		const bytes = new TextEncoder().encode(text);
		return { identity: `Assistant response: ${entry.id}`, bytes, hash: hash(bytes) };
	}
	throw new Error("No completed visible assistant response is available on this branch.");
}

function startChild(
	snapshot: string,
	cwd: string,
	env: NodeJS.ProcessEnv,
	boundary: AnnotationBoundary,
): AnnotationChild {
	const child = boundary.spawn("plannotator", ["annotate", snapshot, "--json"], {
		cwd,
		env,
		detached: boundary.platform !== "win32",
		windowsHide: boundary.platform === "win32",
		stdio: ["ignore", "pipe", "pipe"],
	});
	// Capture creation identity while the root is alive, including fast successful exits.
	const initialProcesses =
		boundary.platform === "win32" && child.pid ? boundary.processes() : Promise.resolve([]);
	// Observation failure is surfaced by stop(), not as an unhandled rejection.
	void initialProcesses.catch(() => {});
	let stdout = "";
	let stderr = "";
	child.stdout.setEncoding("utf8");
	child.stderr.setEncoding("utf8");
	child.stdout.on("data", (chunk: string) => {
		stdout += chunk;
	});
	child.stderr.on("data", (chunk: string) => {
		stderr += chunk;
	});
	let closed = false;
	const completion = Promise.withResolvers<{
		code: number | null;
		stdout: string;
		stderr: string;
	}>();
	const closure = Promise.withResolvers<void>();
	const result = completion.promise;
	child.once("error", error => {
		completion.reject(
			(error as NodeJS.ErrnoException).code === "ENOENT"
				? new Error(
						"Plannotator is not available. The host must supply the native Plannotator executable on PATH.",
					)
				: error,
		);
	});
	child.once("close", code => {
		closed = true;
		completion.resolve({ code, stdout, stderr });
		closure.resolve();
	});
	async function signalGroup(signal: NodeJS.Signals): Promise<boolean> {
		if (!child.pid) return false;
		try {
			boundary.kill(-child.pid, signal);
			return true;
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code === "ESRCH") return false;
			if (code !== "EPERM" || boundary.platform !== "darwin") throw error;
			// Let the host reap an exited leader before retrying Darwin's
			// zombie-only group refusal. Live-group permission failures stay visible.
			await boundary.sleep(0);
			if (!closed && typeof child.exitCode !== "number" && !child.signalCode) throw error;
			try {
				boundary.kill(-child.pid, signal);
				return true;
			} catch (retryError) {
				if ((retryError as NodeJS.ErrnoException).code === "ESRCH") return false;
				throw retryError;
			}
		}
	}
	let stopping: Promise<void> | undefined;
	function stop(): Promise<void> {
		stopping ??= (async () => {
			if (boundary.platform === "win32" && child.pid) {
				const initial = await initialProcesses;
				const current = await boundary.processes();
				const root = initial.find(identity => identity.pid === child.pid);
				if (!root) {
					if (current.some(identity => identity.pid === child.pid || identity.parentPid === child.pid))
						throw new Error("Cannot establish the owned Windows process creation identity.");
				} else {
					// Never discover new descendants below a PID now owned by another root.
					const observedRoot = current.find(identity => identity.pid === root.pid);
					const owned = ownedTree(
						root,
						observedRoot && observedRoot.created !== root.created ? initial : [...initial, ...current],
					);
					let live = surviving(owned, current);
					// /T would rebuild ancestry from bare PIDs and bypass creation-qualified ownership.
					if (live.some(identity => identity.pid === root.pid)) {
						const request = await boundary.taskkill(root.pid, false);
						if (request.code !== 0) {
							const reasons = [...request.output.matchAll(/Reason:\s*([^\r\n]+)/giu)].map(
								match => match[1] ?? "",
							);
							const expectedReasons = reasons.length ? reasons : [request.output];
							const expected =
								expectedReasons.every(reason =>
									/can only be terminated forcefully|child processes of this process were still running/iu.test(
										reason,
									),
								) && !/denied/iu.test(request.output);
							if (!expected) {
								const remaining = surviving(owned, await boundary.processes());
								if (remaining.length || !/not found|no running instance/iu.test(request.output))
									throw new Error(`Windows termination failed: ${request.output.trim()}`);
							}
						}
					}
					if (live.length) await boundary.sleep(1000);
					const afterGrace = await boundary.processes();
					// Only still-matching parents can establish children born during the grace.
					for (const identity of surviving(owned, afterGrace)) {
						for (const descendant of ownedTree(identity, afterGrace)) {
							if (!owned.some(member => member.pid === descendant.pid)) owned.push(descendant);
						}
					}
					live = surviving(owned, afterGrace);
					for (let index = live.length - 1; index >= 0; index--) {
						const identity = live[index];
						if (!identity) continue;
						// Children precede parents. Re-query in case an owned process already exited.
						if (!surviving([identity], await boundary.processes()).length) continue;
						const forced = await boundary.taskkill(identity.pid, true);
						if (forced.code !== 0) {
							const remaining = surviving([identity], await boundary.processes());
							if (remaining.length || !/not found|no running instance/iu.test(forced.output))
								throw new Error(`Windows force termination failed: ${forced.output.trim()}`);
						}
					}
					if (surviving(owned, await boundary.processes()).length)
						throw new Error("Owned Windows processes survived force termination.");
				}
			} else if (boundary.platform !== "win32" && (await signalGroup("SIGTERM"))) {
				// Root close is not group close: descendants receive the full grace.
				await boundary.sleep(1000);
				await signalGroup("SIGKILL");
			}
			// Child close includes stdout/stderr closure; do not remove a live snapshot.
			if (!closed) await closure.promise;
		})();
		return stopping;
	}
	return { result, stop };
}

function outcome(stdout: string): string | null {
	let value: unknown;
	try {
		value = JSON.parse(stdout);
	} catch {
		throw new Error("Plannotator returned malformed JSON.");
	}
	if (!value || typeof value !== "object" || !("decision" in value)) {
		throw new Error("Plannotator returned no annotation decision.");
	}
	if (value.decision === "dismissed") return null;
	if (value.decision !== "annotated") {
		throw new Error(
			`Unexpected Plannotator decision: ${JSON.stringify(value.decision)}. No feedback was sent.`,
		);
	}
	if (!("feedback" in value) || typeof value.feedback !== "string") {
		throw new Error("Plannotator returned invalid annotation feedback.");
	}
	return value.feedback;
}

function stillOwned(review: Review, ctx: ExtensionContext): boolean {
	return (
		!review.cancelled &&
		!review.settled &&
		ctx.sessionManager.getSessionId() === review.sessionId &&
		(review.anchor === null ||
			ctx.sessionManager.getBranch().some(entry => entry.id === review.anchor))
	);
}

async function feedbackEnvelope(
	snapshot: Snapshot,
	review: Review,
	feedback: string,
): Promise<string> {
	let warning = "";
	if (snapshot.path) {
		try {
			if (hash(await readDocumentBytes(snapshot.path)) !== snapshot.hash) {
				warning =
					"\nWarning: The source changed after this snapshot. Feedback refers to the reviewed snapshot, not the current file.\n";
			}
		} catch {
			warning =
				"\nWarning: The source is no longer readable. Feedback refers to the reviewed snapshot.\n";
		}
	}
	return [
		"Visual annotation feedback (not approval or an instruction to apply edits).",
		`Session: ${review.sessionId}`,
		`Branch anchor: ${review.anchor ?? "empty branch"}`,
		snapshot.identity,
		`Snapshot SHA-256: ${snapshot.hash}`,
		warning,
		"Annotations:",
		feedback,
	].join("\n");
}

export default function plannotator(
	pi: ExtensionAPI,
	injected: Partial<AnnotationBoundary> = {},
): void {
	const boundary = { ...defaultBoundary(), ...injected };
	const reviews = new Map<string, Review>();

	async function run(
		review: Review,
		ctx: ExtensionContext,
		target: string | undefined,
		env: NodeJS.ProcessEnv,
	): Promise<void> {
		let directory: string | undefined;
		try {
			const snapshot =
				target === undefined ? responseSnapshot(ctx) : await documentSnapshot(target, ctx, boundary);
			if (!stillOwned(review, ctx)) return;
			directory = await mkdtemp(join(tmpdir(), "omp-plannotator-"));
			const path = join(directory, "snapshot.md");
			await writeFile(path, snapshot.bytes, { mode: 0o600, flag: "wx" });
			if (!stillOwned(review, ctx)) return;
			review.child = startChild(path, ctx.cwd, env, boundary);
			ctx.ui.setStatus(STATUS_KEY, `Reviewing ${review.label} · /plannotator-cancel`);
			const result = await review.child.result;
			if (!stillOwned(review, ctx)) return;
			if (result.code !== 0) {
				throw new Error(
					`Plannotator failed (exit ${result.code ?? "signal"}): ${result.stderr.trim()}`,
				);
			}
			const feedback = outcome(result.stdout);
			if (feedback === null || !feedback.trim()) {
				review.settled = true;
				ctx.ui.notify(
					feedback === null
						? "Plannotator review dismissed."
						: "Plannotator review finished without feedback.",
					"info",
				);
				return;
			}
			const envelope = await feedbackEnvelope(snapshot, review, feedback);
			if (!stillOwned(review, ctx)) return;
			review.settled = true;
			pi.sendMessage(
				{ customType: "plannotator-feedback", content: envelope, display: true, attribution: "user" },
				{ deliverAs: "followUp", triggerTurn: true },
			);
			ctx.ui.notify("Plannotator feedback queued for this conversation.", "info");
		} catch (error) {
			if (!review.cancelled)
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
		} finally {
			review.settled = true;
			try {
				await review.child?.stop();
				if (directory) await rm(directory, { recursive: true, force: true });
			} catch (error) {
				ctx.ui.notify(
					`Plannotator cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
					"error",
				);
			} finally {
				if (reviews.get(review.sessionId) === review) {
					reviews.delete(review.sessionId);
					ctx.ui.setStatus(STATUS_KEY, undefined);
				}
			}
		}
	}

	function start(target: string | undefined, ctx: ExtensionContext): void {
		const sessionId = ctx.sessionManager.getSessionId();
		const existing = reviews.get(sessionId);
		if (existing) {
			ctx.ui.notify(
				`A review is already pending for ${existing.label}. Use /plannotator-cancel.`,
				"info",
			);
			return;
		}
		try {
			const env = localEnvironment(ctx, boundary);
			const review: Review = {
				sessionId,
				anchor: ctx.sessionManager.getLeafId(),
				label: target ?? "the last assistant response",
				cancelled: false,
				settled: false,
				done: Promise.resolve(),
			};
			reviews.set(sessionId, review);
			ctx.ui.setStatus(STATUS_KEY, `Preparing ${review.label} · /plannotator-cancel`);
			review.done = run(review, ctx, target, env);
		} catch (error) {
			ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
		}
	}

	async function cancel(ctx: ExtensionContext, explicit = false): Promise<void> {
		const review = reviews.get(ctx.sessionManager.getSessionId());
		if (!review) {
			if (explicit) ctx.ui.notify("No Plannotator review is pending.", "info");
			return;
		}
		review.cancelled = true;
		try {
			await review.child?.stop();
			await review.done;
			if (explicit) ctx.ui.notify("Plannotator review cancelled.", "info");
		} catch (error) {
			ctx.ui.notify(
				`Plannotator cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
				"error",
			);
		}
	}

	pi.registerCommand("plannotator-annotate", {
		description: "Annotate a UTF-8 document or session-local document in the browser",
		handler: async (args, ctx) => {
			const target = args.trim().replace(/^(["'])(.*)\1$/u, "$2");
			if (!target)
				ctx.ui.notify("Usage: /plannotator-annotate <document path or local://document>", "error");
			else start(target, ctx);
		},
	});
	pi.registerCommand("plannotator-last", {
		description: "Annotate the last completed visible assistant response on this branch",
		handler: async (args, ctx) => {
			if (args.trim()) ctx.ui.notify("Usage: /plannotator-last", "error");
			else start(undefined, ctx);
		},
	});
	pi.registerCommand("plannotator-cancel", {
		description: "Cancel this session's pending annotation review",
		handler: async (_args, ctx) => {
			await cancel(ctx, true);
		},
	});
	for (const event of [
		"session_before_switch",
		"session_before_branch",
		"session_before_tree",
		"session_shutdown",
	] as const) {
		pi.on(event, async (_event, ctx) => {
			await cancel(ctx);
		});
	}
}
