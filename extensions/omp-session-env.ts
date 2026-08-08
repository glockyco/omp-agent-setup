import { readlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

/** The filesystem operation used by the session-start bin check. */
export interface OmpSessionEnvFs {
	readlink(path: string): string;
}

/** Inputs for the pure OMP bin warning decision. */
export interface OmpBinWarningState {
	/** Absolute path of the managed `omp` bin. */
	binPath: string;
	/** Raw symlink target, or `undefined` when the bin could not be read. */
	linkTarget: string | undefined;
	/** Absolute path of the source CLI entry the bin should target. */
	desiredTarget: string;
	/** Whether this extension instance has already emitted its warning. */
	warningShown: boolean;
}

/** The two outcomes of the pure OMP bin warning decision. */
export type OmpBinWarningDecision = "silent" | "warn";

/**
 * Decide whether a stale OMP bin deserves a warning.
 *
 * Missing or unreadable bins stay silent: without a symlink target we cannot
 * truthfully claim that OMP is running the unpatched bundle. The warning state
 * prevents repeated notifications if a host invokes the handler more than once.
 */
export function decideOmpBinWarning(state: OmpBinWarningState): OmpBinWarningDecision {
	if (state.warningShown || state.linkTarget === undefined) return "silent";
	const target = isAbsolute(state.linkTarget)
		? normalize(state.linkTarget)
		: normalize(join(dirname(state.binPath), state.linkTarget));
	return target === normalize(state.desiredTarget) ? "silent" : "warn";
}

const OMP_UNPATCHED_BUNDLE_MESSAGE =
	"OMP is running the unpatched bundle; run " + "cd ~/Projects/omp-agent-setup && bun run bootstrap";

const realFs: OmpSessionEnvFs = { readlink: path => readlinkSync(path, "utf8") };

function checkOmpBin(
	ctx: ExtensionContext,
	fs: OmpSessionEnvFs,
	env: NodeJS.ProcessEnv,
	home: string,
	warningShown: boolean,
): boolean {
	try {
		const bunInstall = env.BUN_INSTALL?.trim() || join(home, ".bun");
		const binPath = join(bunInstall, "bin", "omp");
		const linkTarget = fs.readlink(binPath);
		const decision = decideOmpBinWarning({
			binPath,
			linkTarget,
			desiredTarget: join(
				bunInstall,
				"install",
				"global",
				"node_modules",
				"@oh-my-pi",
				"pi-coding-agent",
				"src",
				"cli.ts",
			),
			warningShown,
		});
		if (decision === "warn") {
			ctx.ui.notify(OMP_UNPATCHED_BUNDLE_MESSAGE, "warning");
			return true;
		}
	} catch {
		// A missing or unreadable global bin must never break session startup.
	}
	return warningShown;
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

export default function ompSessionEnv(pi: ExtensionAPI, fs: OmpSessionEnvFs = realFs): void {
	// OMP_AGENT_DIR is stable across sessions, so seed it eagerly at factory
	// time. The session-specific vars require a SessionManager and land in the
	// session_start handler below.
	process.env.OMP_AGENT_DIR ??= defaultAgentDir();
	let warningShown = false;

	pi.on("session_start", (_event, ctx) => {
		installSessionEnvVars(ctx);
		warningShown = checkOmpBin(ctx, fs, process.env, homedir(), warningShown);
	});
}
