import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assembleBootstrap,
	createBootstrapHandler,
	END_MARKER,
	installSessionEnvVars,
	type Logger,
	MARKER,
} from "../extensions/superpowers-bootstrap.ts";

let workdir: string;

const messages: string[] = [];
const logger: Logger = {
	error(message) {
		messages.push(message);
	},
};

beforeEach(async () => {
	workdir = await mkdtemp(join(tmpdir(), "omp-bootstrap-test-"));
	messages.length = 0;
});

afterEach(async () => {
	await rm(workdir, { recursive: true, force: true });
});

async function seedSkill(root: string, body: string): Promise<void> {
	const dir = join(root, "skills", "using-superpowers");
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "SKILL.md"), body);
}

describe("createBootstrapHandler", () => {
	test("injects the bootstrap skill content with markers", async () => {
		await seedSkill(workdir, "BOOTSTRAP CONTENT\n");
		const handle = createBootstrapHandler({ resolveRoot: () => workdir, logger });
		const result = await handle({ systemPrompt: ["existing block"] });
		expect(result?.systemPrompt).toHaveLength(2);
		const appended = result?.systemPrompt?.[1] ?? "";
		expect(appended).toContain(MARKER);
		expect(appended).toContain(END_MARKER);
		expect(appended).toContain("BOOTSTRAP CONTENT");
	});

	test("is idempotent when the marker is already present", async () => {
		await seedSkill(workdir, "BOOTSTRAP CONTENT\n");
		const handle = createBootstrapHandler({ resolveRoot: () => workdir, logger });
		const result = await handle({ systemPrompt: [`${MARKER}\nstale\n${END_MARKER}`] });
		expect(result).toBeUndefined();
	});

	test("caches the bootstrap content across calls with the same root", async () => {
		await seedSkill(workdir, "FIRST\n");
		const handle = createBootstrapHandler({ resolveRoot: () => workdir, logger });
		const first = await handle({ systemPrompt: [] });
		// Overwrite the file. If the handler is cached, the second call still
		// returns the first content.
		await writeFile(join(workdir, "skills", "using-superpowers", "SKILL.md"), "SECOND\n");
		const second = await handle({ systemPrompt: [] });
		expect(first?.systemPrompt?.[0]).toBe(second?.systemPrompt?.[0]);
		expect(first?.systemPrompt?.[0]).toContain("FIRST");
	});

	test("re-reads when the resolved root changes", async () => {
		const otherRoot = await mkdtemp(join(tmpdir(), "omp-bootstrap-other-"));
		try {
			await seedSkill(workdir, "FROM A\n");
			await seedSkill(otherRoot, "FROM B\n");
			let active = workdir;
			const handle = createBootstrapHandler({ resolveRoot: () => active, logger });
			const first = await handle({ systemPrompt: [] });
			expect(first?.systemPrompt?.[0]).toContain("FROM A");
			active = otherRoot;
			const second = await handle({ systemPrompt: [] });
			expect(second?.systemPrompt?.[0]).toContain("FROM B");
		} finally {
			await rm(otherRoot, { recursive: true, force: true });
		}
	});

	test("returns a visible error message when the skill is missing", async () => {
		const handle = createBootstrapHandler({ resolveRoot: () => workdir, logger });
		const result = await handle({ systemPrompt: [] });
		expect(result?.systemPrompt).toBeUndefined();
		expect(result?.message?.customType).toBe("superpowers-bootstrap-error");
		expect(result?.message?.content).toContain("Superpowers bootstrap unavailable");
		expect(messages[0]).toContain("Superpowers bootstrap unavailable");
	});
});

describe("assembleBootstrap", () => {
	test("wraps content with both SUPERPOWERS_BOOTSTRAP and EXTREMELY_IMPORTANT", () => {
		const out = assembleBootstrap("body text\n");
		expect(out).toStartWith(MARKER);
		expect(out).toEndWith(END_MARKER);
		expect(out).toContain("<EXTREMELY_IMPORTANT>");
		expect(out).toContain("</EXTREMELY_IMPORTANT>");
	});

	test("includes the load-bearing preamble lines verbatim", () => {
		const out = assembleBootstrap("body\n");
		expect(out).toContain("You have superpowers.");
		expect(out).toContain("ALREADY LOADED");
		expect(out).toContain("Do NOT invoke `read skill://using-superpowers` again");
		expect(out).toContain("read skill://<name>");
	});

	test("strips YAML frontmatter from the start of skill content", () => {
		const skill = "---\nname: using-superpowers\ndescription: x\n---\n\nreal body\n";
		const out = assembleBootstrap(skill);
		expect(out).toContain("real body");
		expect(out).not.toContain("---");
		expect(out).not.toContain("name: using-superpowers");
	});

	test("leaves content with no frontmatter untouched apart from the wrapper", () => {
		const out = assembleBootstrap("no fm here\nstill content\n");
		expect(out).toContain("no fm here");
		expect(out).toContain("still content");
	});

	test("handles malformed frontmatter (no closing fence) by skipping the strip", () => {
		const skill = "---\nname: oops\n\nbody without fence close\n";
		const out = assembleBootstrap(skill);
		expect(out).toContain("body without fence close");
		// First fence stays in because the second one was missing.
		expect(out).toContain("---");
	});
});

import type { BeforeAgentStartEvent, ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import superpowersBootstrap from "../extensions/superpowers-bootstrap.ts";

describe("defaultResolveRoot", () => {
	test("honors SUPERPOWERS_ROOT environment variable", async () => {
		await seedSkill(workdir, "FROM ENV\n");
		const previousEnv = process.env.SUPERPOWERS_ROOT;
		process.env.SUPERPOWERS_ROOT = workdir;
		try {
			const handle = createBootstrapHandler({ logger });
			const result = await handle({ systemPrompt: [] });
			expect(result?.systemPrompt?.[0]).toContain("FROM ENV");
		} finally {
			if (previousEnv === undefined) delete process.env.SUPERPOWERS_ROOT;
			else process.env.SUPERPOWERS_ROOT = previousEnv;
		}
	});
});

describe("superpowersBootstrap default export", () => {
	test("registers a before_agent_start handler on the extension API", async () => {
		const handlers: Array<(event: BeforeAgentStartEvent) => unknown> = [];
		const stubApi = {
			logger,
			on(event: string, handler: (event: BeforeAgentStartEvent) => unknown) {
				if (event === "before_agent_start") {
					handlers.push(handler as (event: BeforeAgentStartEvent) => unknown);
				}
			},
		} as unknown as ExtensionAPI;

		await seedSkill(workdir, "EXTENSION CONTENT\n");
		const previousEnv = process.env.SUPERPOWERS_ROOT;
		process.env.SUPERPOWERS_ROOT = workdir;
		try {
			superpowersBootstrap(stubApi);
			expect(handlers).toHaveLength(1);
			const event: BeforeAgentStartEvent = {
				type: "before_agent_start",
				prompt: "",
				systemPrompt: [],
			};
			const result = (await handlers[0]?.(event)) as { systemPrompt?: string[] };
			expect(result?.systemPrompt?.[0]).toContain("EXTENSION CONTENT");
		} finally {
			if (previousEnv === undefined) delete process.env.SUPERPOWERS_ROOT;
			else process.env.SUPERPOWERS_ROOT = previousEnv;
		}
	});
});

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
});

describe("superpowersBootstrap default export — session_start wiring", () => {
	test("session_start handler injects env vars", () => {
		const handlers: Record<string, ((event: unknown, ctx: unknown) => unknown)[]> = {};
		const stubApi = {
			logger,
			on(event: string, handler: (event: unknown, ctx: unknown) => unknown) {
				let list = handlers[event];
				if (!list) {
					list = [];
					handlers[event] = list;
				}
				list.push(handler);
			},
		} as unknown as ExtensionAPI;

		// Stash & restore the env vars we touch.
		const keys = ["OMP_LOCAL_DIR", "OMP_SESSION_DIR", "OMP_SESSION_ID", "OMP_AGENT_DIR"] as const;
		const previous: Record<string, string | undefined> = {};
		for (const k of keys) previous[k] = process.env[k];
		for (const k of keys) delete process.env[k];
		try {
			superpowersBootstrap(stubApi);
			expect(process.env.OMP_AGENT_DIR).toBeDefined();
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
