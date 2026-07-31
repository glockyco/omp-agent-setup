import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
	AgentEndEvent,
	ExtensionAPI,
	ExtensionContext,
	ToolResultEvent,
	ToolResultEventResult,
} from "@oh-my-pi/pi-coding-agent";

interface HookRunResult {
	exitCode: number;
	stdout: string;
	audit: Record<string, unknown>;
}

interface ImpeccableHookLib {
	runHook(options: {
		stdinJson: Record<string, unknown>;
		env: NodeJS.ProcessEnv;
		cwd: string;
	}): Promise<HookRunResult>;
	runStopHook(options: {
		stdinJson: Record<string, unknown>;
		env: NodeJS.ProcessEnv;
		cwd: string;
	}): Promise<HookRunResult>;
}

const DESIGN_TOOLS = new Set(["edit", "write"]);
const HOOK_ATTRIBUTION = "impeccable-design-hook";

/**
 * Resolve the globally managed hook library without importing relative to this
 * source file. The extension itself is loaded through a symlink under
 * `~/.omp/agent/extensions/`, so relative imports would resolve against that
 * deployed path and break as soon as the repository moves.
 */
export function impeccableHookLibPath(
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
): string {
	const agentDir = env.OMP_AGENT_DIR ?? env.PI_CODING_AGENT_DIR ?? join(home, ".omp", "agent");
	return join(agentDir, "skills", "impeccable", "scripts", "hook-lib.mjs");
}

/** Extract the model-facing reminder from Impeccable's Claude hook envelope. */
export function parseHookReminder(stdout: string): string | null {
	if (!stdout.trim()) return null;
	try {
		const parsed = JSON.parse(stdout) as {
			hookSpecificOutput?: { additionalContext?: unknown };
			additionalContext?: unknown;
		};
		const value = parsed.hookSpecificOutput?.additionalContext ?? parsed.additionalContext;
		return typeof value === "string" && value.trim() ? value.trim() : null;
	} catch {
		return null;
	}
}

/** Build the provider-neutral subset of a PostToolUse payload Impeccable reads. */
export function postToolUsePayload(
	event: Pick<ToolResultEvent, "toolName" | "input">,
	ctx: Pick<ExtensionContext, "cwd" | "sessionManager">,
): Record<string, unknown> {
	return {
		hook_event_name: "PostToolUse",
		cwd: ctx.cwd,
		session_id: ctx.sessionManager.getSessionId(),
		tool_name: event.toolName,
		tool_input: event.input,
	};
}

/** Build the terminal deep-pass payload keyed to the same per-session cache. */
export function stopPayload(
	ctx: Pick<ExtensionContext, "cwd" | "sessionManager">,
): Record<string, unknown> {
	return {
		hook_event_name: "Stop",
		cwd: ctx.cwd,
		session_id: ctx.sessionManager.getSessionId(),
		stop_hook_active: false,
	};
}

function hookEnv(): NodeJS.ProcessEnv {
	return { ...process.env, IMPECCABLE_HOOK_HARNESS: "claude" };
}

async function loadHookLib(): Promise<ImpeccableHookLib> {
	return (await import(impeccableHookLibPath())) as ImpeccableHookLib;
}

/**
 * Wire Impeccable's existing immediate and deep detector passes into OMP. A
 * detector or loading failure is deliberately fail-open: design lint must
 * never turn a successful file edit into a failed tool call or prevent a turn
 * from settling.
 */
export default function impeccableHook(pi: ExtensionAPI): void {
	// context.mjs runs as a child process and otherwise sees no provider hook
	// manifest for OMP, so it would add a duplicate MANUAL_DETECTOR_REQUIRED
	// fallback. Advertise the extension only when its managed hook library is
	// actually present; hook.enabled=false and IMPECCABLE_HOOK_DISABLED still
	// take precedence inside context.mjs and hook-lib.mjs.
	if (existsSync(impeccableHookLibPath())) process.env.IMPECCABLE_OMP_HOOK = "1";

	let loadFailureReported = false;
	const reportFailure = (error: unknown, ctx: ExtensionContext): void => {
		if (loadFailureReported) return;
		loadFailureReported = true;
		const message = error instanceof Error ? error.message : String(error);
		pi.logger.warn(`Impeccable design hook unavailable: ${message}`);
		ctx.ui.notify("Impeccable design hook unavailable; run its detector manually.", "warning");
	};

	pi.on("tool_result", async (event, ctx): Promise<ToolResultEventResult | undefined> => {
		if (event.isError || !DESIGN_TOOLS.has(event.toolName)) return;
		try {
			const lib = await loadHookLib();
			const result = await lib.runHook({
				stdinJson: postToolUsePayload(event, ctx),
				env: hookEnv(),
				cwd: ctx.cwd,
			});
			const reminder = parseHookReminder(result.stdout);
			if (!reminder) return;
			return {
				content: [...event.content, { type: "text", text: reminder }],
			};
		} catch (error) {
			reportFailure(error, ctx);
		}
	});

	pi.on("agent_end", async (event: AgentEndEvent, ctx): Promise<void> => {
		if (event.willContinue) return;
		try {
			const lib = await loadHookLib();
			const result = await lib.runStopHook({
				stdinJson: stopPayload(ctx),
				env: hookEnv(),
				cwd: ctx.cwd,
			});
			const reminder = parseHookReminder(result.stdout);
			if (!reminder) return;
			pi.sendMessage(
				{
					customType: "impeccable-design-findings",
					content: reminder,
					display: true,
					attribution: HOOK_ATTRIBUTION,
				},
				{ deliverAs: "nextTurn", triggerTurn: true },
			);
		} catch (error) {
			reportFailure(error, ctx);
		}
	});
}
