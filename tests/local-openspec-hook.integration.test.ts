import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

setDefaultTimeout(30_000);

const repository = join(import.meta.dir, "..");
const cliVersion = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"))
	.devDependencies["@fission-ai/openspec"] as string;
const readme = readFileSync(join(repository, "README.md"), "utf8");
const windows = process.platform === "win32";
const documented = readme.match(
	windows ? /PowerShell:\n\n```powershell\n([\s\S]*?)\n```/u : /POSIX:\n\n```sh\n([\s\S]*?)\n```/u,
)?.[1];
if (!documented) throw new Error("Missing documented host-local OpenSpec hook");
const commandText = documented;
const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function hook(kind: "matching" | "mismatch" | "unsupported" | "invalid") {
	const root = mkdtempSync(join(tmpdir(), "documented OpenSpec hook "));
	roots.push(root);
	mkdirSync(join(root, "openspec/specs/example"), { recursive: true });
	writeFileSync(join(root, "openspec/config.yaml"), "schema: spec-driven\n");
	writeFileSync(
		join(root, "openspec/specs/example/spec.md"),
		kind === "invalid"
			? "# Invalid\n"
			: "# Example\n\n## Purpose\nVerify the documented host-local gate offline with the same pinned CLI as CI.\n\n## Requirements\n\n### Requirement: Host-local validation\nThe fixture SHALL be checked.\n\n#### Scenario: Local check\n- **WHEN** the host-local hook runs\n- **THEN** validation passes\n",
	);
	const bin = join(root, "host bin");
	mkdirSync(bin);
	// Test-only host CLI doubles expose mismatch/unsupported behavior without downloads.
	// Positive and invalid fixtures use the actual frozen npm CLI through its installed shim.
	if (kind === "mismatch" || kind === "unsupported") {
		const version = kind === "mismatch" ? "0.0.0" : cliVersion;
		writeFileSync(
			join(bin, windows ? "openspec.cmd" : "openspec"),
			windows
				? `@echo off\r\nif "%~1"=="--version" (echo ${version}& exit /b 0)\r\necho validate --all\r\nexit /b 0\r\n`
				: `#!/bin/sh\nif [ "$1" = "--version" ]; then printf '%s\\n' '${version}'; else printf '%s\\n' 'validate --all'; fi\n`,
			{ mode: 0o755 },
		);
	}
	const separator = windows ? ";" : ":";
	const env: NodeJS.ProcessEnv = {
		...process.env,
		CI: "1",
		OPENSPEC_TELEMETRY: "0",
	};
	// Windows treats Path/PATH alike, but a copied JS object can contain both.
	// Remove the inherited spelling before adding the fixture's search path.
	if (windows) for (const key of Object.keys(env)) if (key.toUpperCase() === "PATH") delete env[key];
	env.PATH = [bin, join(repository, "node_modules/.bin"), process.env.PATH ?? ""].join(separator);
	const child = Bun.spawn(
		windows
			? [
					join(
						process.env.SystemRoot ?? "C:\\Windows",
						"System32/WindowsPowerShell/v1.0/powershell.exe",
					),
					"-NoProfile",
					"-NonInteractive",
					"-Command",
					commandText,
				]
			: ["sh", "-c", commandText],
		{
			cwd: root,
			env,
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return { code, output: stdout + stderr };
}

test("documented native host-local hook runs matching frozen CLI offline", async () => {
	const result = await hook("matching");
	expect(result.code).toBe(0);
	expect(result.output).toContain("passed");
}, 30000);

test("documented hook reports expected/observed version mismatch", async () => {
	const result = await hook("mismatch");
	expect(result.code).not.toBe(0);
	expect(result.output).toContain(`Expected OpenSpec ${cliVersion}, observed 0.0.0`);
});

test("documented hook rejects a host CLI without archive validation", async () => {
	const result = await hook("unsupported");
	expect(result.code).not.toBe(0);
	expect(result.output).toContain("lacks validate --archived");
});

test("documented hook propagates real strict validation failure", async () => {
	expect((await hook("invalid")).code).not.toBe(0);
}, 30000);
