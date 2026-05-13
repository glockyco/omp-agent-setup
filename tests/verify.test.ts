import { describe, expect, test } from "bun:test";
import {
	findExtensionError,
	findMissingSubstring,
	ompDirectSmoke,
	ompExtensionSmoke,
	scanLog,
	type CommandResult,
	type Runner,
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
		expect(findings.map(f => f.message).sort()).toEqual(["Extension error", "Failed to load extension"]);
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
