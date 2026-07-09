import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

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
 * - `PI_CODEX_WEB_SEARCH_MODEL` — small Codex model for fast web_search calls.
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
	env.PI_CODEX_WEB_SEARCH_MODEL ??= "gpt-5.4-mini";
	env.OMP_SESSION_ID = sm.getSessionId();
}

function defaultAgentDir(env: NodeJS.ProcessEnv = process.env): string {
	return env.PI_CODING_AGENT_DIR ?? join(homedir(), ".omp", "agent");
}

export default function ompSessionEnv(pi: ExtensionAPI): void {
	// OMP_AGENT_DIR is stable across sessions, so seed it eagerly at factory
	// time. The session-specific vars require a SessionManager and land in the
	// session_start handler below.
	process.env.OMP_AGENT_DIR ??= defaultAgentDir();

	pi.on("session_start", (_event, ctx) => {
		installSessionEnvVars(ctx);
	});
}
