import { describe, expect, test } from "bun:test";
import {
	type CommandResult,
	findExtensionError,
	findMissingSubstring,
	ompDirectSmoke,
	ompExtensionSmoke,
	type Runner,
	scanLog,
} from "../src/verify.ts";

const stubRunner = (result: Partial<CommandResult>): Runner => ({
	async run() {
		return {
			stdout: "",
			stderr: "",
			exitCode: 0,
			timedOut: false,
			...result,
		};
	},
});

describe("findMissingSubstring", () => {
	test("returns null when all substrings are present", () => {
		expect(findMissingSubstring("alpha beta gamma", ["alpha", "gamma"])).toBeNull();
	});

	test("returns the first missing substring", () => {
		expect(findMissingSubstring("alpha", ["alpha", "missing"])).toBe("missing");
	});
});

describe("findExtensionError", () => {
	test("detects 'Extension error' lines", () => {
		const found = findExtensionError("ok\nExtension error (path): boom\n");
		expect(found).toContain("Extension error");
	});

	test("detects 'Failed to load extension' lines", () => {
		const found = findExtensionError("Failed to load extension path=foo");
		expect(found).toContain("Failed to load extension");
	});

	test("returns null when output is clean", () => {
		expect(findExtensionError("DIRECT_OK\n")).toBeNull();
	});
});

describe("scanLog", () => {
	const log = [
		`{"timestamp":"2026-05-13T13:00:00.000+02:00","level":"warn","pid":1,"message":"old failure","path":"foo"}`,
		`{"timestamp":"2026-05-13T15:30:00.000+02:00","level":"error","pid":2,"message":"Failed to load extension","path":"/x"}`,
		`{"timestamp":"2026-05-13T15:31:00.000+02:00","level":"warn","pid":3,"message":"unrelated"}`,
		`{"timestamp":"2026-05-13T15:32:00.000+02:00","level":"error","pid":4,"message":"Extension error","err":{"code":"EIO"}}`,
		"this is not json",
	].join("\n");

	test("returns only findings newer than the since cutoff", () => {
		const findings = scanLog(log, "2026-05-13T15:00:00.000+02:00", [
			/Failed to load extension/,
			/Extension error/,
		]);
		expect(findings.map(f => f.message).sort()).toEqual([
			"Extension error",
			"Failed to load extension",
		]);
	});

	test("ignores non-JSON and missing timestamps", () => {
		const findings = scanLog(log, "1970-01-01T00:00:00.000Z", [/Failed to load extension/]);
		expect(findings).toHaveLength(1);
	});

	test("returns no findings when the patterns do not match", () => {
		const findings = scanLog(log, "1970-01-01T00:00:00.000Z", [/nothing matches this/]);
		expect(findings).toHaveLength(0);
	});
});

describe("ompExtensionSmoke", () => {
	test("passes when the expected string is present without extension errors", async () => {
		const runner = stubRunner({ stdout: "OMP_SMOKE_OK\n" });
		const result = await ompExtensionSmoke(runner, { model: "anything", expected: "OMP_SMOKE_OK" });
		expect(result.failure).toBeUndefined();
	});

	test("fails when the expected string is missing", async () => {
		const runner = stubRunner({ stdout: "different\n" });
		const result = await ompExtensionSmoke(runner, { model: "anything", expected: "OMP_SMOKE_OK" });
		expect(result.failure).toContain("OMP_SMOKE_OK");
	});

	test("fails when an extension error appears even if the keyword is present", async () => {
		const runner = stubRunner({
			stdout: "Extension error (/path/ext.ts): ENOENT\nOMP_SMOKE_OK\n",
		});
		const result = await ompExtensionSmoke(runner, { model: "anything", expected: "OMP_SMOKE_OK" });
		expect(result.failure).toContain("extension error");
	});
});

describe("ompDirectSmoke", () => {
	test("returns failure when expected substring is absent", async () => {
		const runner = stubRunner({ stdout: "different\n" });
		const result = await ompDirectSmoke(runner, { expected: "DIRECT_OK" });
		expect(result.failure).toContain("DIRECT_OK");
	});
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSkillLoader, ompAcceptanceSmoke } from "../src/verify.ts";

describe("ompAcceptanceSmoke", () => {
	test("passes when at least one mention pattern matches", async () => {
		const runner = stubRunner({ stdout: "Let's brainstorm before we code\n" });
		const result = await ompAcceptanceSmoke(runner, {
			model: "x",
			prompt: "y",
			mentionPatterns: [/[Bb]rainstorm/, /[Ss]uperpowers/],
		});
		expect(result.failure).toBeUndefined();
	});

	test("fails when no mention pattern matches", async () => {
		const runner = stubRunner({ stdout: "irrelevant\n" });
		const result = await ompAcceptanceSmoke(runner, {
			model: "x",
			prompt: "y",
			mentionPatterns: [/[Bb]rainstorm/],
		});
		expect(result.failure).toContain("[Bb]rainstorm");
	});
});

describe("checkSkillLoader", () => {
	test("returns missing names that the loader did not surface", async () => {
		const work = await mkdtemp(join(tmpdir(), "omp-skillcheck-test-"));
		try {
			const fakeLoader = join(work, "skills.ts");
			await writeFile(
				fakeLoader,
				`export async function loadSkills() {
					return { skills: [{ name: "alpha" }, { name: "beta" }] };
				}`,
			);
			const result = await checkSkillLoader({
				customDirectories: [],
				requiredSkillNames: ["alpha", "missing"],
				ompCodingAgentSrc: fakeLoader,
			});
			expect(result.loadedNames).toEqual(["alpha", "beta"]);
			expect(result.missing).toEqual(["missing"]);
		} finally {
			await rm(work, { recursive: true, force: true });
		}
	});
});
