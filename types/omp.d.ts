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

	// biome-ignore lint/suspicious/noConfusingVoidType: mirrors the upstream OMP API shape, which uses `void` in this union intentionally
	export type ExtensionHandler<E, R = void> = (event: E) => Promise<R | void> | R | void;

	export interface ExtensionAPI {
		logger: Logger;
		on(
			event: "before_agent_start",
			handler: ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult>,
		): void;
	}
}
