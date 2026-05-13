import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

export const MARKER = "<SUPERPOWERS_BOOTSTRAP>";
export const END_MARKER = "</SUPERPOWERS_BOOTSTRAP>";
const DEFAULT_SUPERPOWERS_ROOT = "~/Projects/superpowers";

/**
 * Wrapper text injected around the `using-superpowers` skill content. Mirrors
 * the upstream `hooks/session-start` framing — `<EXTREMELY_IMPORTANT>` for
 * attention weight, "You have superpowers" preamble, and an explicit guard
 * against re-invoking the bootstrap skill — adapted to OMP-native language
 * (`read skill://…` instead of "the Skill tool") and OMP's flat namespace
 * (no `superpowers:` prefix). Outer `<SUPERPOWERS_BOOTSTRAP>` marker stays
 * for the {@link alreadyInjected} idempotency check.
 */
const PREAMBLE = `<EXTREMELY_IMPORTANT>
You have superpowers.

**IMPORTANT: The \`using-superpowers\` skill content is included below. It is ALREADY LOADED — you are currently following it. Do NOT invoke \`read skill://using-superpowers\` again, that would be redundant. For all other skills, use \`read skill://<name>\` (e.g. \`read skill://brainstorming\`).**
`;
const POSTAMBLE = "</EXTREMELY_IMPORTANT>";

/**
 * Strip a YAML frontmatter block (`---\\n…\\n---\\n`) from the start of skill
 * content. The frontmatter is metadata (`name`, `description`) consumed by the
 * skill loader, not prompt material; injecting it as-is wastes tokens and
 * looks like noise to the model.
 */
function stripFrontmatter(content: string): string {
	if (!content.startsWith("---\n")) return content;
	const end = content.indexOf("\n---\n", 4);
	if (end === -1) return content;
	return content.slice(end + "\n---\n".length).replace(/^\s*\n/, "");
}

/** Build the full injected block. Pure for testability. */
export function assembleBootstrap(skillContent: string): string {
	const body = stripFrontmatter(skillContent).trimEnd();
	return `${MARKER}\n${PREAMBLE}\n${body}\n${POSTAMBLE}\n${END_MARKER}`;
}

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
				cachedPrompt = assembleBootstrap(content);
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

/**
 * Inject session-scoped OMP paths into the process environment so subprocesses
 * spawned via the bash tool (and any tool authored to consume them — primarily
 * plannotator's standalone CLI and slash handlers) can resolve OMP internal
 * URIs like `local://PLAN.md` without re-implementing OMP's session-dir
 * discovery from scratch.
 *
 * Vars set:
 * - `OMP_LOCAL_DIR`     — `<artifactsDir>/local` (session scratch root).
 * - `OMP_SESSION_DIR`   — full per-session artifacts directory.
 * - `OMP_SESSION_ID`    — session UUID.
 * - `OMP_AGENT_DIR`     — `$PI_CODING_AGENT_DIR ?? ~/.omp/agent`.
 *
 * Timing note: `pi-utils/procmgr.ts:buildSpawnEnv` snapshots `Bun.env` into a
 * cached `cachedShellConfig` on the first bash spawn. We rely on `session_start`
 * firing during session bootstrap, before the agent loop starts dispatching
 * tool calls — i.e. before any bash exec — so the cache captures the injected
 * vars. `OMP_AGENT_DIR` is also set at factory time as a belt-and-braces guard
 * against any future code path that warms the cache earlier than expected.
 */
export function installSessionEnvVars(
	ctx: Pick<ExtensionContext, "sessionManager">,
	env: NodeJS.ProcessEnv = process.env,
): void {
	const sm = ctx.sessionManager;
	const artifactsDir = sm.getArtifactsDir();
	if (artifactsDir !== null) {
		env.OMP_LOCAL_DIR = join(artifactsDir, "local");
		env.OMP_SESSION_DIR = artifactsDir;
	}
	env.OMP_SESSION_ID = sm.getSessionId();
}

function defaultAgentDir(env: NodeJS.ProcessEnv = process.env): string {
	return env.PI_CODING_AGENT_DIR ?? join(homedir(), ".omp", "agent");
}

export default function superpowersBootstrap(pi: ExtensionAPI): void {
	// OMP_AGENT_DIR is stable across sessions, so seed it eagerly at factory
	// time. The session-specific vars require a SessionManager and land in the
	// session_start handler below.
	process.env.OMP_AGENT_DIR ??= defaultAgentDir();

	const handler = createBootstrapHandler({ logger: pi.logger });
	pi.on("before_agent_start", async event => {
		return await handler(event);
	});

	pi.on("session_start", (_event, ctx) => {
		installSessionEnvVars(ctx);
	});
}
