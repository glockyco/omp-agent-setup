import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createBootstrapHandler,
	END_MARKER,
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
