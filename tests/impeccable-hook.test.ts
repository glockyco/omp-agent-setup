import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	AgentEndEvent,
	ExtensionAPI,
	ExtensionContext,
	ToolResultEvent,
	ToolResultEventResult,
} from "@oh-my-pi/pi-coding-agent";
import impeccableHook, {
	impeccableHookLibPath,
	parseHookReminder,
	postToolUsePayload,
	stopPayload,
} from "../extensions/impeccable-hook.ts";

let root: string;
const originalAgentDir = process.env.OMP_AGENT_DIR;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "omp-impeccable-hook-"));
	process.env.OMP_AGENT_DIR = join(import.meta.dir, "..", "agent");
});

afterEach(async () => {
	if (originalAgentDir === undefined) delete process.env.OMP_AGENT_DIR;
	else process.env.OMP_AGENT_DIR = originalAgentDir;
	await rm(root, { recursive: true, force: true });
});

function extensionContext(sessionId = "session-123"): ExtensionContext {
	return {
		cwd: root,
		hasUI: false,
		ui: { notify() {}, setStatus() {} },
		sessionManager: {
			getCwd: () => root,
			getSessionDir: () => root,
			getSessionId: () => sessionId,
			getArtifactsDir: () => null,
		},
	};
}

function writeEvent(path: string): ToolResultEvent {
	return {
		type: "tool_result",
		toolName: "write",
		toolCallId: "call-1",
		input: { path },
		content: [{ type: "text", text: "Successfully wrote file." }],
		isError: false,
		details: undefined,
	};
}

interface CapturedExtension {
	toolResult(
		event: ToolResultEvent,
		ctx: ExtensionContext,
	): Promise<ToolResultEventResult | undefined>;
	agentEnd(event: AgentEndEvent, ctx: ExtensionContext): Promise<void>;
	messages: Array<{ content: string; options: unknown }>;
}

function captureExtension(): CapturedExtension {
	let toolResult: CapturedExtension["toolResult"] | undefined;
	let agentEnd: CapturedExtension["agentEnd"] | undefined;
	const messages: CapturedExtension["messages"] = [];
	const pi = {
		logger: { error() {}, warn() {}, info() {}, debug() {} },
		on(event: string, handler: unknown) {
			if (event === "tool_result") toolResult = handler as CapturedExtension["toolResult"];
			if (event === "agent_end") agentEnd = handler as CapturedExtension["agentEnd"];
		},
		sendMessage(message: { content: string }, options: unknown) {
			messages.push({ content: message.content, options });
		},
	} as unknown as ExtensionAPI;
	impeccableHook(pi);
	if (!toolResult || !agentEnd) throw new Error("Impeccable hook did not register both handlers");
	return { toolResult, agentEnd, messages };
}

describe("impeccable hook helpers", () => {
	test("resolves the managed hook library from OMP_AGENT_DIR", () => {
		expect(impeccableHookLibPath({ OMP_AGENT_DIR: "/agent" }, "/home/demo")).toBe(
			"/agent/skills/impeccable/scripts/hook-lib.mjs",
		);
		expect(impeccableHookLibPath({}, "/home/demo")).toBe(
			"/home/demo/.omp/agent/skills/impeccable/scripts/hook-lib.mjs",
		);
	});

	test("extracts only non-empty additional context from hook envelopes", () => {
		expect(
			parseHookReminder(
				JSON.stringify({ hookSpecificOutput: { additionalContext: "  fix the contrast  " } }),
			),
		).toBe("fix the contrast");
		expect(parseHookReminder(JSON.stringify({ hookSpecificOutput: {} }))).toBeNull();
		expect(parseHookReminder("not-json")).toBeNull();
	});

	test("uses one session key for the immediate and terminal passes", () => {
		const ctx = extensionContext("same-session");
		expect(postToolUsePayload(writeEvent("ui.css"), ctx)).toMatchObject({
			hook_event_name: "PostToolUse",
			session_id: "same-session",
			tool_input: { path: "ui.css" },
		});
		expect(stopPayload(ctx)).toMatchObject({
			hook_event_name: "Stop",
			session_id: "same-session",
		});
	});

	test("suppresses context.mjs's manual fallback while the OMP hook is active", async () => {
		await writeFile(join(root, "PRODUCT.md"), "# Product\n\nTest product.\n");
		const contextScript = join(
			process.env.OMP_AGENT_DIR ?? "",
			"skills",
			"impeccable",
			"scripts",
			"context.mjs",
		);

		const result = Bun.spawnSync({
			cmd: ["node", contextScript],
			cwd: root,
			env: { ...process.env, IMPECCABLE_OMP_HOOK: "1" },
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).not.toContain("MANUAL_DETECTOR_REQUIRED");
	});
});

describe("impeccable hook extension", () => {
	test("appends immediate detector findings to the write result", async () => {
		const css = join(root, "page.css");
		await writeFile(
			css,
			".hero { background: linear-gradient(red, blue); background-clip: text; color: transparent; }\n",
		);
		const extension = captureExtension();

		const result = await extension.toolResult(writeEvent(css), extensionContext());

		expect(result?.content?.[0]).toEqual({ type: "text", text: "Successfully wrote file." });
		const lastContent = result?.content?.at(-1);
		expect(lastContent).toMatchObject({ type: "text" });
		if (lastContent?.type !== "text") throw new Error("Expected a text reminder");
		expect(lastContent.text).toContain("gradient-text");
	});

	test("skips failed and non-writing tool results", async () => {
		const extension = captureExtension();
		const failed = { ...writeEvent(join(root, "page.css")), isError: true };
		const read = { ...writeEvent(join(root, "page.css")), toolName: "read" };

		expect(await extension.toolResult(failed, extensionContext())).toBeUndefined();
		expect(await extension.toolResult(read, extensionContext())).toBeUndefined();
	});

	test("runs the deep pass once when the agent settles", async () => {
		await mkdir(join(root, "src"), { recursive: true });
		const stylesheet = join(root, "src", "app.css");
		await writeFile(stylesheet, ".hero { font-family: Inter, sans-serif; }\n");
		const extension = captureExtension();
		const ctx = extensionContext();
		await extension.toolResult(writeEvent(stylesheet), ctx);

		await extension.agentEnd({ type: "agent_end", messages: [], willContinue: true }, ctx);
		expect(extension.messages).toHaveLength(0);
		await extension.agentEnd({ type: "agent_end", messages: [], willContinue: false }, ctx);

		expect(extension.messages).toHaveLength(1);
		expect(extension.messages[0]?.content).toContain("overused-font");
		expect(extension.messages[0]?.options).toEqual({ deliverAs: "nextTurn", triggerTurn: true });
	});
});
