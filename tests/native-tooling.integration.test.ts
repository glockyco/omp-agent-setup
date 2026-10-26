import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { checkOpenSpec, workflowGate } from "../scripts/check-openspec.ts";
import { runHook } from "../scripts/hooks.ts";
import { openspecAdapters } from "../scripts/openspec-adapters.ts";

setDefaultTimeout(30_000);
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
	// The byte snapshot includes Git metadata, so fixture commits must not start background writers.
	await git(["config", "maintenance.auto", "false"]);
	await git(["config", "gc.auto", "0"]);
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

test("local gate separates expensive CI checks and stops on a local failure", async () => {
	const root = fixture();
	const { scripts } = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
	const local = [
		"check:toolchain",
		"check:lint",
		"check:types",
		"check:dead",
		"check:release",
		"check:test:unit",
		"check:openspec-adapters",
		"check:openspec",
	];
	const complete = [
		...local.map(name => (name === "check:test:unit" ? "check:test" : name)),
		"check:audit",
		"check:installed-release",
	];
	put(
		root,
		"package.json",
		JSON.stringify({
			scripts: {
				"check:local": scripts["check:local"],
				ci: scripts.ci,
				...Object.fromEntries(
					[...local, "check:test", "check:audit", "check:installed-release"].map(name => [
						name,
						`bun gate-probe.ts ${name}`,
					]),
				),
			},
		}),
	);
	put(
		root,
		"gate-probe.ts",
		"import { appendFileSync } from 'node:fs'; const name=process.argv[2]; appendFileSync('gate.log', name+'\\n'); if(process.env.LOCAL_GATE_FAIL===name) process.exit(23);\n",
	);
	async function run(name: string, fail?: string): Promise<string[]> {
		put(root, "gate.log", "");
		const child = Bun.spawn([process.execPath, "run", name], {
			cwd: root,
			env: { ...process.env, LOCAL_GATE_FAIL: fail ?? "" },
			stdout: "ignore",
			stderr: "ignore",
		});
		expect(await child.exited).toBe(fail ? 23 : 0);
		return readFileSync(join(root, "gate.log"), "utf8").trim().split("\n");
	}
	expect(await run("check:local")).toEqual(local);
	expect(await run("ci")).toEqual(complete);
	expect(await run("ci", "check:types")).toEqual(local.slice(0, 3));
	const hooks = Bun.YAML.parse(readFileSync(join(repository, "lefthook.yml"), "utf8")) as {
		"pre-push": { commands: Record<string, { run: string }> };
	};
	expect(Object.values(hooks["pre-push"].commands).map(command => command.run)).toEqual([
		"bun scripts/hooks.ts bun install --frozen-lockfile",
		"bun scripts/hooks.ts bun run check:local",
	]);
}, 30_000);

test("configured message hook uses native Bun without an optional executable alias", async () => {
	const root = fixture();
	const message = join(root, "commit message with spaces");
	const hooks = Bun.YAML.parse(readFileSync(join(repository, "lefthook.yml"), "utf8")) as {
		"commit-msg": { commands: { commitlint: { run: string } } };
	};
	const command = hooks["commit-msg"].commands.commitlint.run.split(/\s+/);
	expect(command.shift()).toBe("bun");
	const args = command.map(arg => (arg === '"{1}"' ? message : arg));
	const env = { ...process.env };
	const path = Object.entries(env).find(([key]) => key.toUpperCase() === "PATH")?.[1] ?? "";
	for (const key of Object.keys(env)) if (key.toUpperCase() === "PATH") delete env[key];
	env.PATH = path
		.split(delimiter)
		.filter(
			directory => !["bunx", "bunx.exe", "bunx.cmd"].some(name => existsSync(join(directory, name))),
		)
		.join(delimiter);
	async function validate(contents: string): Promise<number> {
		writeFileSync(message, contents);
		const child = Bun.spawn([process.execPath, ...args], {
			cwd: repository,
			env,
			stdout: "ignore",
			stderr: "ignore",
		});
		return child.exited;
	}
	expect(
		await validate(
			"test(hooks): use the installed native tool\n\nValidate without an alias or download.\n",
		),
	).toBe(0);
	expect(await validate("not a conventional commit\n")).not.toBe(0);
}, 30_000);

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
