import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import ompSessionEnv, { installSessionEnvVars } from "../extensions/omp-session-env.ts";

describe("installSessionEnvVars", () => {
	test("sets OMP_LOCAL_DIR/OMP_SESSION_DIR/OMP_SESSION_ID from sessionManager", () => {
		const env: NodeJS.ProcessEnv = {};
		installSessionEnvVars(
			{
				sessionManager: {
					getCwd: () => "/cwd",
					getSessionDir: () => "/parent",
					getSessionId: () => "ses-123",
					getArtifactsDir: () => "/parent/2026-01-01_xyz",
				},
			},
			env,
		);
		expect(env.OMP_LOCAL_DIR).toBe("/parent/2026-01-01_xyz/local");
		expect(env.OMP_SESSION_DIR).toBe("/parent/2026-01-01_xyz");
		expect(env.OMP_SESSION_ID).toBe("ses-123");
	});

	test("omits OMP_LOCAL_DIR and OMP_SESSION_DIR when getArtifactsDir returns null", () => {
		const env: NodeJS.ProcessEnv = {};
		installSessionEnvVars(
			{
				sessionManager: {
					getCwd: () => "/cwd",
					getSessionDir: () => "/parent",
					getSessionId: () => "ses-456",
					getArtifactsDir: () => null,
				},
			},
			env,
		);
		expect(env.OMP_LOCAL_DIR).toBeUndefined();
		expect(env.OMP_SESSION_DIR).toBeUndefined();
		expect(env.OMP_SESSION_ID).toBe("ses-456");
	});

	test("sets Codex web search to a small model by default without overriding user env", () => {
		const env: NodeJS.ProcessEnv = {};
		installSessionEnvVars(
			{
				sessionManager: {
					getCwd: () => "/cwd",
					getSessionDir: () => "/parent",
					getSessionId: () => "ses-789",
					getArtifactsDir: () => null,
				},
			},
			env,
		);
		expect(env.PI_CODEX_WEB_SEARCH_MODEL).toBe("gpt-5.4-mini");

		const existingEnv: NodeJS.ProcessEnv = { PI_CODEX_WEB_SEARCH_MODEL: "gpt-5.4-nano" };
		installSessionEnvVars(
			{
				sessionManager: {
					getCwd: () => "/cwd",
					getSessionDir: () => "/parent",
					getSessionId: () => "ses-790",
					getArtifactsDir: () => null,
				},
			},
			existingEnv,
		);
		expect(existingEnv.PI_CODEX_WEB_SEARCH_MODEL).toBe("gpt-5.4-nano");
	});
});

describe("ompSessionEnv extension", () => {
	test("registers only the session_start environment handler", () => {
		const handlers: Record<string, ((event: unknown, ctx: unknown) => unknown)[]> = {};
		const stubApi = {
			logger: { error() {} },
			on(event: string, handler: (event: unknown, ctx: unknown) => unknown) {
				let list = handlers[event];
				if (!list) {
					list = [];
					handlers[event] = list;
				}
				list.push(handler);
			},
		} as unknown as ExtensionAPI;

		const keys = ["OMP_LOCAL_DIR", "OMP_SESSION_DIR", "OMP_SESSION_ID", "OMP_AGENT_DIR"] as const;
		const previous: Record<string, string | undefined> = {};
		for (const k of keys) previous[k] = process.env[k];
		for (const k of keys) delete process.env[k];
		try {
			ompSessionEnv(stubApi);
			expect(Object.keys(handlers)).toEqual(["session_start"]);
			expect(process.env.OMP_AGENT_DIR).toBe(`${homedir()}/.omp/agent`);

			const sessionStart = handlers.session_start ?? [];
			expect(sessionStart).toHaveLength(1);
			const handler = sessionStart[0];
			if (!handler) throw new Error("expected a session_start handler");

			handler(
				{ type: "session_start" },
				{
					cwd: "/cwd",
					sessionManager: {
						getCwd: () => "/cwd",
						getSessionDir: () => "/parent",
						getSessionId: () => "ses-xyz",
						getArtifactsDir: () => "/parent/2026-05-13_abc",
					},
				},
			);
			expect(process.env.OMP_LOCAL_DIR).toBe("/parent/2026-05-13_abc/local");
			expect(process.env.OMP_SESSION_DIR).toBe("/parent/2026-05-13_abc");
			expect(process.env.OMP_SESSION_ID).toBe("ses-xyz");
		} finally {
			for (const k of keys) {
				const value = previous[k];
				if (value === undefined) delete process.env[k];
				else process.env[k] = value;
			}
		}
	});
});
