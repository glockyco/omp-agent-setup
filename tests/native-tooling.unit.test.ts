import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkToolchain } from "../scripts/check-toolchain.ts";
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
