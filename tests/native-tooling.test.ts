import { afterEach, expect, test } from "bun:test";
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkOpenSpec, workflowGate } from "../scripts/check-openspec.ts";
import { checkToolchain } from "../scripts/check-toolchain.ts";
import { runHook } from "../scripts/hooks.ts";
import { compareAdapters, openspecAdapters } from "../scripts/openspec-adapters.ts";

const repository = join(import.meta.dir, "..");
const cli = join(repository, "node_modules/@fission-ai/openspec/bin/openspec.js");
const scratch: string[] = [];
function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), "personal native tooling "));
	scratch.push(root);
	return root;
}
function put(root: string, path: string, content: string): void {
	const target = join(root, path);
	mkdirSync(join(target, ".."), { recursive: true });
	writeFileSync(target, content);
}
afterEach(() => {
	for (const root of scratch.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("Bun mismatch and Renovate/OpenSpec mirror drift name expected and observed versions", () => {
	const root = fixture();
	for (const path of [
		".bun-version",
		"renovate.json",
		"package.json",
		".github/workflows/openspec.yml",
	]) {
		put(root, path, readFileSync(join(repository, path), "utf8"));
	}
	const pin = readFileSync(join(root, ".bun-version"), "utf8").trim();
	const generator = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).devDependencies[
		"@fission-ai/openspec"
	];
	expect(checkToolchain(root, pin)).toEqual([]);
	expect(checkToolchain(root, "0.0.0").join("\n")).toContain(`expected ${pin}, observed 0.0.0`);
	const renovate = JSON.parse(readFileSync(join(root, "renovate.json"), "utf8"));
	renovate.constraints.bun = "0.0.0";
	put(root, "renovate.json", JSON.stringify(renovate));
	expect(checkToolchain(root, pin).join("\n")).toContain(`expected ${pin}, observed 0.0.0`);
	put(root, ".github/workflows/openspec.yml", "@fission-ai/openspec@0.0.0");
	expect(checkToolchain(root, pin).join("\n")).toContain(
		`expected generator ${generator}, observed 0.0.0`,
	);
});

test("adapter inventory compares bytes and rejects missing/extra commands and skills", () => {
	const actual = fixture();
	const expected = fixture();
	for (const root of [actual, expected]) {
		put(root, "commands/opsx-apply.md", "exact\r\n");
		put(root, "skills/openspec-apply-change/SKILL.md", "skill\n");
	}
	expect(compareAdapters(actual, expected)).toEqual([]);
	put(actual, "commands/opsx-apply.md", "exact\n");
	expect(compareAdapters(actual, expected)).toContain("Adapter drift: commands/opsx-apply.md");
	rmSync(join(actual, "commands/opsx-apply.md"));
	rmSync(join(actual, "skills/openspec-apply-change"), { recursive: true });
	put(actual, "commands/extra.md", "extra");
	put(actual, "skills/openspec-extra/SKILL.md", "extra");
	expect(compareAdapters(actual, expected)).toEqual([
		"Missing adapter: commands/opsx-apply.md",
		"Missing adapter: skills/openspec-apply-change/SKILL.md",
		"Extra adapter: commands/extra.md",
		"Extra adapter: skills/openspec-extra/SKILL.md",
	]);
});

test("adapter freshness rejects an extra empty skill directory", () => {
	const actual = fixture();
	const expected = fixture();
	mkdirSync(join(actual, "skills/openspec-empty"), { recursive: true });
	expect(compareAdapters(actual, expected)).toEqual(["Extra adapter: skills/openspec-empty/"]);
});

test("real native generation/check preserves all checkout bytes and non-OpenSpec skills", async () => {
	const root = fixture();
	put(root, "plugin/package.json", "{}");
	put(root, "plugin/skills/personal/SKILL.md", "not generated");
	put(root, "openspec/config.yaml", readFileSync(join(repository, "openspec/config.yaml"), "utf8"));
	expect(await openspecAdapters(root, "sync", cli)).toEqual([]);
	async function git(args: string[]): Promise<string> {
		const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "inherit" });
		const output = await new Response(child.stdout).text();
		expect(await child.exited).toBe(0);
		return output;
	}
	await git(["init"]);
	await git(["add", "."]);
	await git([
		"-c",
		"user.name=Fixture",
		"-c",
		"user.email=fixture@example.invalid",
		"commit",
		"-m",
		"test: generated fixture",
	]);
	expect(await git(["status", "--porcelain"])).toBe("");
	function snapshot(directory: string): Record<string, string> {
		const result: Record<string, string> = {};
		for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
			if (entry.isFile()) {
				const path = join(entry.parentPath, entry.name);
				result[path] = readFileSync(path).toString("base64");
			}
		}
		return result;
	}
	const before = snapshot(root);
	expect(await openspecAdapters(root, "check", cli)).toEqual([]);
	expect(snapshot(root)).toEqual(before);
	expect(await git(["status", "--porcelain"])).toBe("");
	expect(readFileSync(join(root, "plugin/skills/personal/SKILL.md"), "utf8")).toBe("not generated");
}, 30000);

const validSpec =
	"# Fixture\n\n## Purpose\nVerify portable strict artifact validation without unrelated caller dependencies.\n\n## Requirements\n\n### Requirement: Valid fixture\nThe fixture SHALL be validated.\n\n#### Scenario: Validation\n- **WHEN** validation runs\n- **THEN** the fixture passes\n";
function artifacts(root: string, nested = ""): void {
	put(root, join(nested, "openspec/config.yaml"), "schema: spec-driven\n");
	put(root, join(nested, "openspec/specs/fixture/spec.md"), validSpec);
}

test("shared workflow gate accepts default and nested roots using the actual pinned CLI", async () => {
	const root = fixture();
	artifacts(root);
	artifacts(root, "nested root");
	expect(await checkOpenSpec(repository, root, ".", cli)).toBe(0);
	expect(await checkOpenSpec(repository, root, "nested root", cli)).toBe(0);
}, 30000);

test("shared gate rejects invalid artifacts and unchecked archived tasks", async () => {
	const root = fixture();
	artifacts(root);
	put(root, "openspec/specs/fixture/spec.md", "# Invalid\n");
	expect(await checkOpenSpec(repository, root, ".", cli)).not.toBe(0);
	put(root, "openspec/specs/fixture/spec.md", validSpec);
	put(
		root,
		"openspec/changes/archive/2026-10-11-unfinished/tasks.md",
		"## Tasks\n- [ ] unfinished\n",
	);
	expect(await checkOpenSpec(repository, root, ".", cli)).not.toBe(0);
}, 30000);

test("shared gate rejects unavailable, absolute and escaping roots", async () => {
	const root = fixture();
	artifacts(root);
	for (const input of [root, "C:\\outside", "../", "missing", "no-artifacts"]) {
		mkdirSync(join(root, "no-artifacts"), { recursive: true });
		expect(await checkOpenSpec(repository, root, input, cli)).not.toBe(0);
	}
});

test("archive-support guard fails before either validation and propagates CLI failure", async () => {
	const root = fixture();
	artifacts(root);
	const fake = join(root, "fake-cli.cjs");
	writeFileSync(fake, "console.log('validate --all');\n");
	expect(await checkOpenSpec(repository, root, ".", fake)).not.toBe(0);
	writeFileSync(
		fake,
		"if(process.argv.includes('--help')) console.log('--archived'); else process.exit(23);\n",
	);
	expect(await checkOpenSpec(repository, root, ".", fake)).not.toBe(0);
	expect(workflowGate(repository)).toContain("'--archived', '--strict', '--no-interactive'");
});

test("native hook child strips Git-local variables without mutating parent and propagates failures", async () => {
	const root = fixture();
	const init = Bun.spawn(["git", "init", root], { stdout: "ignore", stderr: "ignore" });
	expect(await init.exited).toBe(0);
	const env = {
		...process.env,
		GIT_DIR: join(root, ".git"),
		GIT_INDEX_FILE: join(root, "alternate index"),
		PERSONAL_KEEP: "kept",
	};
	const probe = join(root, "probe.ts");
	writeFileSync(
		probe,
		"if(process.env.GIT_DIR || process.env.GIT_INDEX_FILE || process.env.PERSONAL_KEEP !== 'kept') process.exit(99);\n",
	);
	expect(await runHook([process.execPath, probe], root, env)).toBe(0);
	expect(env.GIT_DIR).toBe(join(root, ".git"));
	expect(await runHook([process.execPath, "-e", "process.exit(17)"], root, env)).toBe(17);
});

test("installed lefthook retains real commit/message/push hook authority at paths with spaces", async () => {
	const root = fixture();
	const remote = fixture();
	async function git(args: string[]): Promise<number> {
		const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "ignore", stderr: "ignore" });
		return child.exited;
	}
	expect(await git(["init"])).toBe(0);
	expect(await git(["config", "user.name", "Fixture"])).toBe(0);
	expect(await git(["config", "user.email", "fixture@example.invalid"])).toBe(0);
	cpSync(join(repository, "scripts/hooks.ts"), join(root, "hooks.ts"));
	put(
		root,
		"lefthook.yml",
		`pre-commit:\n  commands:\n    native:\n      run: bun hooks.ts bun hook-probe.ts commit\ncommit-msg:\n  commands:\n    native:\n      run: bun hooks.ts bun hook-probe.ts message "{1}"\npre-push:\n  commands:\n    native:\n      run: bun hooks.ts bun hook-probe.ts push\n`,
	);
	put(
		root,
		"hook-probe.ts",
		"import {existsSync, readFileSync} from 'node:fs'; const kind=process.argv[2]; if(existsSync('reject-'+kind)) process.exit(31); if(kind==='message' && !readFileSync(process.argv[3], 'utf8').startsWith('test:')) process.exit(32); if(kind==='push' && process.env.GIT_DIR) process.exit(33);\n",
	);
	const install = Bun.spawn(
		[process.execPath, join(repository, "node_modules/lefthook/bin/index.js"), "install"],
		{ cwd: root, stdout: "ignore", stderr: "inherit" },
	);
	expect(await install.exited).toBe(0);
	put(root, "tracked file.txt", "fixture\n");
	expect(await git(["add", "."])).toBe(0);
	put(root, "reject-commit", "");
	expect(await git(["commit", "-m", "test: valid"])).not.toBe(0);
	rmSync(join(root, "reject-commit"));
	expect(await git(["commit", "-m", "invalid message"])).not.toBe(0);
	expect(await git(["commit", "-m", "test: valid"])).toBe(0);
	expect(await git(["init", "--bare", remote])).toBe(0);
	expect(await git(["remote", "add", "origin", remote])).toBe(0);
	put(root, "reject-push", "");
	expect(await git(["push", "origin", "HEAD:main"])).not.toBe(0);
	rmSync(join(root, "reject-push"));
	expect(await git(["push", "origin", "HEAD:main"])).toBe(0);
}, 30000);

test("shared gate rejects an empty OpenSpec root instead of accepting a vacuous check", async () => {
	const root = fixture();
	put(root, "openspec/config.yaml", "schema: spec-driven\n");
	expect(await checkOpenSpec(repository, root, ".", cli)).not.toBe(0);
});

test("shared gate forwards exactly both strict commands with telemetry disabled", async () => {
	const root = fixture();
	artifacts(root);
	const log = join(root, "cli-arguments.jsonl");
	const fake = join(root, "record-cli.cjs");
	writeFileSync(
		fake,
		`const fs=require('node:fs'); fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({args:process.argv.slice(2),ci:process.env.CI,telemetry:process.env.OPENSPEC_TELEMETRY})+'\\n'); if(process.argv.includes('--help')) console.log('--archived'); else console.log('valid');\n`,
	);
	expect(await checkOpenSpec(repository, root, ".", fake)).toBe(0);
	expect(
		readFileSync(log, "utf8")
			.trim()
			.split("\n")
			.map(line => JSON.parse(line)),
	).toEqual([
		{ args: ["validate", "--help"], ci: "1", telemetry: "0" },
		{ args: ["validate", "--all", "--strict", "--no-interactive"], ci: "1", telemetry: "0" },
		{ args: ["validate", "--archived", "--strict", "--no-interactive"], ci: "1", telemetry: "0" },
	]);
});
