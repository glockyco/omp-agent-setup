import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@oh-my-pi/pi-coding-agent";
import type { AnnotationBoundary } from "../../plugin/extensions/plannotator";

const pluginRoot = process.env.PERSONAL_PLUGIN_DIR ?? join(import.meta.dir, "..", "..", "plugin");
// Exercise the manifest payload selected by the source run or the installed-release check.
const { default: plannotator } = await import(
	pathToFileURL(join(pluginRoot, "extensions/plannotator.ts")).href
);

type Handler = (args: string, ctx: ExtensionContext) => Promise<void>;
type EventHandler = (event: { type: string }, ctx: ExtensionContext) => Promise<void>;
export interface Host {
	ctx: ExtensionContext;
	branch: SessionEntry[];
	notices: Array<{ message: string; type?: string }>;
	feedback: Array<{ content: string }>;
	status?: string;
	command(name: string, args?: string): Promise<void>;
	event(name: string): Promise<void>;
}

export async function createHost(
	root: string,
	id: string,
	boundary: Partial<AnnotationBoundary> = {},
): Promise<Host> {
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
	return instance;
}

export async function until(
	condition: () => boolean | Promise<boolean>,
	timeout: number,
): Promise<void> {
	const deadline = Date.now() + timeout;
	while (!(await condition())) {
		if (Date.now() > deadline) throw new Error("Timed out waiting for annotation state.");
		await Bun.sleep(10);
	}
}
