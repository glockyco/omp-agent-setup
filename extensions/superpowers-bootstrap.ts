import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export const MARKER = "<SUPERPOWERS_BOOTSTRAP>";
export const END_MARKER = "</SUPERPOWERS_BOOTSTRAP>";
const DEFAULT_SUPERPOWERS_ROOT = "~/Projects/superpowers";

/**
 * Inline tilde expansion. The bootstrap extension ships as a self-contained
 * file deployed via symlink to `~/.omp/agent/extensions/`; OMP resolves its
 * relative imports against the symlink path rather than the source path, so
 * the extension cannot reach back into the repository's src/ tree at runtime.
 */
function expandHome(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return join(homedir(), path.slice(2));
	return path;
}

export interface BootstrapHandlerEvent {
	systemPrompt: readonly string[];
}

export interface BootstrapHandlerResult {
	systemPrompt?: string[];
	message?: {
		customType: string;
		content: string;
		display: boolean;
		attribution: string;
	};
}

export interface Logger {
	error: (message: string) => void;
}

export interface BootstrapHandlerOptions {
	/** Resolves the Superpowers root each invocation. Defaults to env + ~/Projects/superpowers. */
	resolveRoot?: () => string;
	logger: Logger;
}

function defaultResolveRoot(): string {
	return expandHome(process.env.SUPERPOWERS_ROOT ?? DEFAULT_SUPERPOWERS_ROOT);
}

function alreadyInjected(systemPrompt: readonly string[]): boolean {
	return systemPrompt.some(block => block.includes(MARKER));
}

/**
 * Build the `before_agent_start` handler. Exposed (and tested) as a pure
 * factory so the extension's behavior can be exercised without a live OMP
 * runtime: caching across calls, idempotency when the bootstrap is already
 * present, and non-fatal degradation when the skill file is missing.
 */
export function createBootstrapHandler(
	options: BootstrapHandlerOptions,
): (event: BootstrapHandlerEvent) => Promise<BootstrapHandlerResult | undefined> {
	let cachedPrompt: string | undefined;
	let cachedRoot: string | undefined;
	const resolveRoot = options.resolveRoot ?? defaultResolveRoot;

	return async function handle(event) {
		if (alreadyInjected(event.systemPrompt)) {
			return undefined;
		}
		const root = resolveRoot();
		const skillPath = join(root, "skills", "using-superpowers", "SKILL.md");
		try {
			if (cachedPrompt === undefined || cachedRoot !== root) {
				const content = await readFile(skillPath, "utf8");
				cachedPrompt = `${MARKER}\n${content}\n${END_MARKER}`;
				cachedRoot = root;
			}
			return { systemPrompt: [...event.systemPrompt, cachedPrompt] };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			options.logger.error(`Superpowers bootstrap unavailable at ${skillPath}: ${message}`);
			return {
				message: {
					customType: "superpowers-bootstrap-error",
					content: `Superpowers bootstrap unavailable at ${skillPath}: ${message}`,
					display: true,
					attribution: "system",
				},
			};
		}
	};
}

export default function superpowersBootstrap(pi: ExtensionAPI): void {
	const handler = createBootstrapHandler({ logger: pi.logger });
	pi.on("before_agent_start", async event => {
		return await handler(event);
	});
}
