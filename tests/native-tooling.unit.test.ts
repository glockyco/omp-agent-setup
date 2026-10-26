import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkToolchain, openspecMirrors } from "../scripts/check-toolchain.ts";
import { compareAdapters } from "../scripts/openspec-adapters.ts";

const repository = join(import.meta.dir, "..");
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
		"README.md",
		"nix/openspec/package-lock.json",
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
	put(
		root,
		".github/workflows/openspec.yml",
		readFileSync(join(root, ".github/workflows/openspec.yml"), "utf8").replace(
			/@fission-ai\/openspec@[\d.]+/,
			"@fission-ai/openspec@0.0.0",
		),
	);
	expect(checkToolchain(root, pin).join("\n")).toContain(
		`expected generator ${generator}, observed 0.0.0`,
	);
});

test("canonical OpenSpec changes invalidate every generated mirror and both Nix lock roots", () => {
	const root = fixture();
	for (const path of [
		".bun-version",
		"renovate.json",
		"package.json",
		".github/workflows/openspec.yml",
		"README.md",
		"nix/openspec/package-lock.json",
	]) {
		put(root, path, readFileSync(join(repository, path), "utf8"));
	}
	const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	const previous = manifest.devDependencies["@fission-ai/openspec"];
	manifest.devDependencies["@fission-ai/openspec"] = "9.8.7";
	put(root, "package.json", JSON.stringify(manifest));
	const bun = readFileSync(join(root, ".bun-version"), "utf8").trim();
	const findings = checkToolchain(root, bun);
	for (const name of [
		"OpenSpec workflow",
		"OpenSpec POSIX hook",
		"OpenSpec POSIX hook diagnostic",
		"OpenSpec PowerShell hook",
		"OpenSpec PowerShell hook diagnostic",
		"OpenSpec Nix lock version",
		'OpenSpec Nix lock packages[""].version',
	]) {
		expect(findings).toContain(`${name}: expected generator 9.8.7, observed ${previous}`);
	}
	expect(findings).toHaveLength(7);
});

test("either Nix package-lock root version can independently invalidate the native toolchain", () => {
	const root = fixture();
	for (const path of [
		".bun-version",
		"renovate.json",
		"package.json",
		".github/workflows/openspec.yml",
		"README.md",
	]) {
		put(root, path, readFileSync(join(repository, path), "utf8"));
	}
	const original = readFileSync(join(repository, "nix/openspec/package-lock.json"), "utf8");
	const bun = readFileSync(join(root, ".bun-version"), "utf8").trim();
	for (const field of ["version", 'packages[""].version']) {
		const lock = JSON.parse(original);
		if (field === "version") lock.version = "0.0.0";
		else lock.packages[""].version = "0.0.0";
		put(root, "nix/openspec/package-lock.json", JSON.stringify(lock));
		const findings = checkToolchain(root, bun);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toContain(`OpenSpec Nix lock ${field}: expected generator `);
		expect(findings[0]).toContain(", observed 0.0.0");
	}
});

test("OpenSpec mirror sync changes only generated versions and check never writes", () => {
	const root = fixture();
	const version = "9.8.7";
	put(
		root,
		"package.json",
		JSON.stringify({ devDependencies: { "@fission-ai/openspec": version } }),
	);
	const manifest = readFileSync(join(root, "package.json"));
	const selected = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"))
		.devDependencies["@fission-ai/openspec"];
	const unrelated = `# Leave unrelated ${selected} untouched.\r\n`;
	const mirrors = new Map<string, string>();
	for (const path of [".github/workflows/openspec.yml", "README.md"]) {
		const content = readFileSync(join(repository, path), "utf8").replaceAll("\n", "\r\n");
		mirrors.set(path, content);
		put(root, path, content + unrelated);
	}
	expect(openspecMirrors(root)).toHaveLength(5);
	for (const [path, content] of mirrors)
		expect(readFileSync(join(root, path), "utf8")).toBe(content + unrelated);
	expect(openspecMirrors(root, "sync")).toEqual([]);
	expect(openspecMirrors(root)).toEqual([]);
	for (const [path, content] of mirrors) {
		expect(readFileSync(join(root, path), "utf8")).toBe(
			content.replaceAll(selected, version) + unrelated,
		);
	}
	expect(readFileSync(join(root, "package.json"))).toEqual(manifest);
});

test("every generated OpenSpec pin fails independently, including both hook diagnostics", () => {
	const root = fixture();
	put(root, "package.json", readFileSync(join(repository, "package.json"), "utf8"));
	const readme = readFileSync(join(repository, "README.md"), "utf8");
	const workflow = readFileSync(join(repository, ".github/workflows/openspec.yml"), "utf8");
	const cases = [
		["README.md", /(test "\$version" = ")[^"]+/],
		["README.md", /(echo "Expected OpenSpec )[\d.]+/],
		["README.md", /(if \(\$version\.Trim\(\) -ne ')[^']+/],
		["README.md", /(Write-Error "Expected OpenSpec )[\d.]+/],
		[".github/workflows/openspec.yml", /(@fission-ai\/openspec@)[\d.]+/],
	] as const;
	for (const [path, pattern] of cases) {
		put(root, "README.md", readme);
		put(root, ".github/workflows/openspec.yml", workflow);
		put(
			root,
			path,
			(path === "README.md" ? readme : workflow).replace(
				pattern,
				(_match, prefix: string) => `${prefix}0.0.0`,
			),
		);
		expect(openspecMirrors(root)).toHaveLength(1);
		expect(openspecMirrors(root, "sync")).toEqual([]);
		expect(readFileSync(join(root, "README.md"), "utf8")).toBe(readme);
		expect(readFileSync(join(root, ".github/workflows/openspec.yml"), "utf8")).toBe(workflow);
	}
});

test("mirror sync rejects non-exact canonical versions and missing or duplicate mirrors without writes", () => {
	const root = fixture();
	const manifest = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
	const workflow = readFileSync(join(repository, ".github/workflows/openspec.yml"), "utf8");
	const readme = readFileSync(join(repository, "README.md"), "utf8");
	put(root, ".github/workflows/openspec.yml", workflow);
	put(root, "README.md", readme);
	for (const version of ["^1.14.3", "latest", "", null]) {
		manifest.devDependencies["@fission-ai/openspec"] = version;
		put(root, "package.json", JSON.stringify(manifest));
		expect(openspecMirrors(root, "sync")).toEqual([`Invalid exact OpenSpec pin: ${version}`]);
	}
	manifest.devDependencies["@fission-ai/openspec"] = "9.8.7";
	put(root, "package.json", JSON.stringify(manifest));
	for (const broken of ["no hook snippets\n", readme + readme]) {
		put(root, "README.md", broken);
		expect(openspecMirrors(root, "sync")).toHaveLength(4);
		expect(readFileSync(join(root, ".github/workflows/openspec.yml"), "utf8")).toBe(workflow);
		expect(readFileSync(join(root, "README.md"), "utf8")).toBe(broken);
	}
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

test("local selects deterministic units while CI retains every covered integration", () => {
	const { scripts } = JSON.parse(readFileSync(join(repository, "package.json"), "utf8"));
	expect(scripts["check:test:unit"]).toBe("bun test --config=bunfig.unit.toml .unit.test.ts");
	expect(scripts["check:test"]).toBe("bun test --coverage");
	expect(scripts["check:local"]).toContain("bun run check:test:unit");
	expect(scripts.ci).toBe(
		scripts["check:local"].replace("bun run check:test:unit", "bun run check:test") +
			" && bun run check:audit && bun run check:installed-release",
	);
	expect(readFileSync(join(repository, "bunfig.toml"), "utf8")).toContain("coverageThreshold = 0.8");
	expect(readFileSync(join(repository, "bunfig.toml"), "utf8")).toContain("coverage = true");
	expect(readFileSync(join(repository, "bunfig.unit.toml"), "utf8")).toContain("coverage = false");
	expect(
		readdirSync(join(repository, "tests")).filter(
			name => name.endsWith(".test.ts") && !/\.(unit|integration)\.test\.ts$/u.test(name),
		),
	).toEqual([]);
});
