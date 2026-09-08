import { isUtf8 } from "node:buffer";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
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

function hash(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function localEnvironment(ctx: ExtensionContext): NodeJS.ProcessEnv {
	if (ctx.mode !== "tui" || !ctx.hasUI || process.platform === "win32") {
		throw new Error("Plannotator requires a local interactive OMP session on Linux or macOS.");
	}
	if (
		process.env.SSH_CONNECTION ||
		process.env.SSH_CLIENT ||
		process.env.SSH_TTY ||
		/^(1|true)$/iu.test(process.env.PLANNOTATOR_REMOTE ?? "")
	) {
		throw new Error("Plannotator annotation is unavailable in remote sessions.");
	}
	const env = { ...process.env };
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

async function documentSnapshot(target: string, ctx: ExtensionContext): Promise<Snapshot> {
	let path: string;
	if (target.startsWith("local://")) {
		const options = ctx.localProtocolOptions;
		if (!options) throw new Error("This session has no native local:// mapping.");
		const artifactsDir = options.getArtifactsDir?.() ?? null;
		const sessionId = options.getSessionId?.() ?? null;
		if (!artifactsDir && !sessionId) throw new Error("This session has no native local:// identity.");
		// This host-only module is absent during standalone payload discovery.
		const { resolveLocalUrlToFile } = await import(
			"@oh-my-pi/pi-coding-agent/internal-urls/local-protocol"
		);
		const file = await resolveLocalUrlToFile(target, {
			cwd: ctx.cwd,
			localProtocolOptions: {
				getArtifactsDir: () => artifactsDir,
				getSessionId: () => sessionId,
			},
		});
		if (!file) throw new Error("The local:// target is not a document in this session.");
		path = file.path;
	} else {
		if (/^[a-z][a-z\d+.-]*:/iu.test(target)) {
			throw new Error("Unsupported target scheme. Use a filesystem path or local:// document.");
		}
		path = resolve(ctx.cwd, target);
	}
	if (UNSUPPORTED_EXTENSIONS[extname(path).toLowerCase()]) {
		throw new Error(
			"Unsupported document. Use a UTF-8 text or Markdown file, not HTML or binary data.",
		);
	}
	const bytes = await readDocumentBytes(path);
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

function startChild(snapshot: string, cwd: string, env: NodeJS.ProcessEnv): AnnotationChild {
	const child = spawn("plannotator", ["annotate", snapshot, "--json"], {
		cwd,
		env,
		detached: true,
		stdio: ["ignore", "pipe", "pipe"],
	});
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
	const result = new Promise<{ code: number | null; stdout: string; stderr: string }>(
		(resolveResult, reject) => {
			child.once("error", error => {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") {
					reject(
						new Error(
							"Plannotator is not available. Use the managed OMP wrapper with its declared Plannotator package.",
						),
					);
				} else reject(error);
			});
			child.once("close", code => {
				closed = true;
				resolveResult({ code, stdout, stderr });
			});
		},
	);
	function signalGroup(signal: NodeJS.Signals): boolean {
		if (!child.pid) return false;
		try {
			process.kill(-child.pid, signal);
			return true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
			throw error;
		}
	}
	let stopping: Promise<void> | undefined;
	function stop(): Promise<void> {
		stopping ??= (async () => {
			if (!signalGroup("SIGTERM")) return;
			await new Promise<void>(resolveStop => {
				const timer = setTimeout(resolveStop, 1000);
				if (!closed)
					child.once("close", () => {
						clearTimeout(timer);
						resolveStop();
					});
			});
			signalGroup("SIGKILL");
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

export default function plannotator(pi: ExtensionAPI): void {
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
				target === undefined ? responseSnapshot(ctx) : await documentSnapshot(target, ctx);
			if (!stillOwned(review, ctx)) return;
			directory = await mkdtemp(join(tmpdir(), "omp-plannotator-"));
			const path = join(directory, "snapshot.md");
			await writeFile(path, snapshot.bytes, { mode: 0o600, flag: "wx" });
			if (!stillOwned(review, ctx)) return;
			review.child = startChild(path, ctx.cwd, env);
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
				try {
					await review.child?.stop();
				} finally {
					if (directory) await rm(directory, { recursive: true, force: true });
				}
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
			const env = localEnvironment(ctx);
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
		await review.child?.stop();
		await review.done;
		if (explicit) ctx.ui.notify("Plannotator review cancelled.", "info");
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
