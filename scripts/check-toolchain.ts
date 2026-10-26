import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const openSpecMirrors = [
	{
		path: ".github/workflows/openspec.yml",
		pins: [
			{
				name: "OpenSpec workflow",
				pattern: /(--save-exact @fission-ai\/openspec@)([^\s]+)/g,
			},
		],
	},
	{
		path: "README.md",
		pins: [
			{
				name: "OpenSpec POSIX hook",
				pattern: /(test "\$version" = ")([^"\r\n]+)(?=")/g,
			},
			{
				name: "OpenSpec POSIX hook diagnostic",
				pattern: /(echo "Expected OpenSpec )([^\s]+)(?=, observed \$version\.)/g,
			},
			{
				name: "OpenSpec PowerShell hook",
				pattern: /(if \(\$version\.Trim\(\) -ne ')([^'\r\n]+)(?='\))/g,
			},
			{
				name: "OpenSpec PowerShell hook diagnostic",
				pattern: /(Write-Error "Expected OpenSpec )([^\s]+)(?=, observed \$version\.)/g,
			},
		],
	},
];

export function openspecMirrors(root: string, mode: "check" | "sync" = "check"): string[] {
	const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	const version = manifest.devDependencies?.["@fission-ai/openspec"];
	if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version))
		return [`Invalid exact OpenSpec pin: ${version}`];
	const findings: string[] = [];
	const updates: { path: string; before: string; after: string }[] = [];
	for (const mirror of openSpecMirrors) {
		const path = join(root, mirror.path);
		const before = readFileSync(path, "utf8");
		let after = before;
		for (const pin of mirror.pins) {
			const matches = [...before.matchAll(pin.pattern)];
			if (matches.length !== 1) {
				findings.push(`${pin.name}: expected one generated pin, observed ${matches.length}`);
				continue;
			}
			const observed = matches[0]?.[2];
			if (mode === "check" && observed !== version)
				findings.push(`${pin.name}: expected generator ${version}, observed ${observed}`);
			after = after.replace(pin.pattern, (_match, prefix: string) => `${prefix}${version}`);
		}
		updates.push({ path, before, after });
	}
	if (mode === "sync" && !findings.length) {
		for (const update of updates) {
			if (update.before !== update.after) writeFileSync(update.path, update.after);
		}
	}
	return findings;
}

export function checkToolchain(root: string, observed = Bun.version): string[] {
	const expected = readFileSync(join(root, ".bun-version"), "utf8").trim();
	const renovate = JSON.parse(readFileSync(join(root, "renovate.json"), "utf8"));
	const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	const lock = JSON.parse(readFileSync(join(root, "nix/openspec/package-lock.json"), "utf8"));
	const findings: string[] = [];
	if (!/^\d+\.\d+\.\d+$/.test(expected)) findings.push(`Invalid exact Bun pin: ${expected}`);
	if (observed !== expected)
		findings.push(`Bun version: expected ${expected}, observed ${observed}`);
	if (renovate.constraints?.bun !== expected) {
		findings.push(`Renovate Bun mirror: expected ${expected}, observed ${renovate.constraints?.bun}`);
	}
	findings.push(...openspecMirrors(root));
	const generator = manifest.devDependencies?.["@fission-ai/openspec"];
	for (const [name, observed] of [
		["version", lock.version],
		['packages[""].version', lock.packages?.[""]?.version],
	]) {
		if (observed !== generator)
			findings.push(
				`OpenSpec Nix lock ${name}: expected generator ${generator}, observed ${observed}`,
			);
	}
	return findings;
}

if (import.meta.main) {
	const findings = checkToolchain(join(import.meta.dir, ".."));
	for (const finding of findings) console.error(finding);
	process.exitCode = findings.length ? 1 : 0;
}
