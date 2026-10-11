import { readFileSync } from "node:fs";
import { join } from "node:path";

export function checkToolchain(root: string, observed = Bun.version): string[] {
	const expected = readFileSync(join(root, ".bun-version"), "utf8").trim();
	const renovate = JSON.parse(readFileSync(join(root, "renovate.json"), "utf8"));
	const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	const workflow = readFileSync(join(root, ".github/workflows/openspec.yml"), "utf8");
	const workflowPin = workflow.match(/@fission-ai\/openspec@([\d.]+)/)?.[1];
	const findings: string[] = [];
	if (!/^\d+\.\d+\.\d+$/.test(expected)) findings.push(`Invalid exact Bun pin: ${expected}`);
	if (observed !== expected)
		findings.push(`Bun version: expected ${expected}, observed ${observed}`);
	if (renovate.constraints?.bun !== expected) {
		findings.push(`Renovate Bun mirror: expected ${expected}, observed ${renovate.constraints?.bun}`);
	}
	const generator = manifest.devDependencies?.["@fission-ai/openspec"];
	if (!/^\d+\.\d+\.\d+$/.test(generator) || generator !== workflowPin) {
		findings.push(`OpenSpec workflow: expected generator ${generator}, observed ${workflowPin}`);
	}
	return findings;
}

if (import.meta.main) {
	const findings = checkToolchain(join(import.meta.dir, ".."));
	for (const finding of findings) console.error(finding);
	process.exitCode = findings.length ? 1 : 0;
}
