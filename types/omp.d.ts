/**
 * Local minimal type stubs for the OMP extension API surface this repository
 * actually uses. We do not depend on `@oh-my-pi/pi-coding-agent` at build time
 * because that package ships its TypeScript source as its declared types,
 * which forces `tsc` to traverse OMP-internal source files that are written
 * against a different strictness profile.
 *
 * Keep this file narrow: add only the API surface we touch, and update the
 * shape when our extensions reach for new fields.
 */
declare module "@oh-my-pi/pi-coding-agent" {
	export interface Logger {
		error(message: string): void;
		warn(message: string): void;
		info(message: string): void;
		debug(message: string): void;
	}

	export interface CustomMessageInput {
		customType: string;
		content: string;
		display: boolean;
		details?: unknown;
		attribution?: string;
	}

	export interface BeforeAgentStartEvent {
		type: "before_agent_start";
		prompt: string;
		images?: unknown;
		systemPrompt: readonly string[];
	}

	export interface BeforeAgentStartEventResult {
		message?: CustomMessageInput;
		systemPrompt?: string[];
	}

	export interface SessionStartEvent {
		type: "session_start";
	}

	/**
	 * Read-only slice of OMP's session manager surfaced to extensions via
	 * {@link ExtensionContext}. Only the methods our extensions actually use
	 * are declared; expand when new fields are needed.
	 *
	 * `getArtifactsDir` is OMP-specific (not in upstream Pi's
	 * ReadonlySessionManager) and returns `null` for non-persistent sessions.
	 */
	export interface ReadonlySessionManager {
		getCwd(): string;
		getSessionDir(): string;
		getSessionId(): string;
		getArtifactsDir(): string | null;
	}

	export interface ExtensionContext {
		cwd: string;
		sessionManager: ReadonlySessionManager;
	}

	// `void` is intentional here: it expresses "caller ignores the return value"
	// rather than the value `undefined`. Using `undefined` would forbid a
	// handler from returning a meaningful R, even when R is bound to a concrete
	// type. This mirrors OMP's upstream `ExtensionHandler` contract.
	export type ExtensionHandler<E, R = void> = (
		event: E,
		ctx: ExtensionContext,
		// biome-ignore lint/suspicious/noConfusingVoidType: see comment above
	) => Promise<R | void> | R | void;

	export interface ExtensionAPI {
		logger: Logger;
		on(
			event: "before_agent_start",
			handler: ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult>,
		): void;
		on(event: "session_start", handler: ExtensionHandler<SessionStartEvent>): void;
	}
}
