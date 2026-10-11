import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

function inventory(root: string): Map<string, Buffer> {
	const files = new Map<string, Buffer>();
	function visit(directory: string): void {
		if (!existsSync(directory)) return;
		const entries = readdirSync(directory, { withFileTypes: true });
		if (!entries.length && directory !== join(root, "commands")) {
			files.set(`${relative(root, directory).replaceAll("\\", "/")}/`, Buffer.alloc(0));
		}
		for (const entry of entries) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) visit(path);
			else if (entry.isFile())
				files.set(relative(root, path).replaceAll("\\", "/"), readFileSync(path));
			else throw new Error(`Adapter is not a regular file or directory: ${path}`);
		}
	}
	visit(join(root, "commands"));
	if (existsSync(join(root, "skills"))) {
		for (const name of readdirSync(join(root, "skills"))) {
			if (name.startsWith("openspec-")) visit(join(root, "skills", name));
		}
	}
	return files;
}

export function compareAdapters(payload: string, generated: string): string[] {
	const actual = inventory(payload);
	const expected = inventory(generated);
	const findings: string[] = [];
	for (const [name, bytes] of expected) {
		const observed = actual.get(name);
		if (!observed) findings.push(`Missing adapter: ${name}`);
		else if (!bytes.equals(observed)) findings.push(`Adapter drift: ${name}`);
	}
	for (const name of actual.keys()) {
		if (!expected.has(name)) findings.push(`Extra adapter: ${name}`);
	}
	return findings;
}

export async function openspecAdapters(
	root: string,
	mode: "check" | "sync",
	cli = join(root, "node_modules/@fission-ai/openspec/bin/openspec.js"),
): Promise<string[]> {
	if (!existsSync(join(root, "plugin/package.json")))
		throw new Error("Run from the repository root.");
	const scratch = mkdtempSync(join(tmpdir(), "personal-openspec-adapters-"));
	try {
		mkdirSync(join(scratch, "openspec"));
		cpSync(join(root, "openspec/config.yaml"), join(scratch, "openspec/config.yaml"));
		const child = Bun.spawn(["node", cli, "init", "--tools", "oh-my-pi", "."], {
			cwd: scratch,
			env: { ...process.env, CI: "1", OPENSPEC_TELEMETRY: "0" },
			stdout: "ignore",
			stderr: "inherit",
		});
		if ((await child.exited) !== 0) throw new Error("OpenSpec adapter generation failed.");
		const generated = join(scratch, ".omp");
		if (!inventory(generated).size) throw new Error("OpenSpec generated no adapters.");
		const payload = join(root, "plugin");
		if (mode === "check") return compareAdapters(payload, generated);
		rmSync(join(payload, "commands"), { recursive: true, force: true });
		for (const name of readdirSync(join(payload, "skills"))) {
			if (name.startsWith("openspec-")) rmSync(join(payload, "skills", name), { recursive: true });
		}
		cpSync(join(generated, "commands"), join(payload, "commands"), { recursive: true });
		for (const name of readdirSync(join(generated, "skills"))) {
			if (name.startsWith("openspec-")) {
				cpSync(join(generated, "skills", name), join(payload, "skills", name), { recursive: true });
			}
		}
		return [];
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}

if (import.meta.main) {
	const mode = process.argv[2];
	if (mode !== "check" && mode !== "sync") throw new Error("Use check or sync.");
	const findings = await openspecAdapters(join(import.meta.dir, ".."), mode);
	for (const finding of findings) console.error(finding);
	process.exitCode = findings.length ? 1 : 0;
}
