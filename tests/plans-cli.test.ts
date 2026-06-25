import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dir, "..", "src", "plans-cli.ts");

function gitInit(root: string): void {
	Bun.spawnSync({ cmd: ["git", "init", "-q"], cwd: root });
	Bun.spawnSync({ cmd: ["git", "config", "user.email", "t@example.com"], cwd: root });
	Bun.spawnSync({ cmd: ["git", "config", "user.name", "Tester"], cwd: root });
}

function setupRepo(): string {
	const root = mkdtempSync(join(tmpdir(), "plans-cli-"));
	gitInit(root);
	mkdirSync(join(root, "docs", "plans"), { recursive: true });
	writeFileSync(
		join(root, "docs", "plans", "2026-01-01-x.md"),
		"---\ntitle: X\ntype: plan\nstatus: active\ncreated: 2026-01-01\n---\n## Tasks\n- [x] a\n- [ ] b\n",
	);
	Bun.spawnSync({ cmd: ["git", "add", "-A"], cwd: root });
	Bun.spawnSync({ cmd: ["git", "commit", "-qm", "init"], cwd: root });
	return root;
}

function run(cwd: string, args: string[]): { code: number; out: string } {
	const result = Bun.spawnSync({ cmd: ["bun", CLI, ...args], cwd, stdout: "pipe", stderr: "pipe" });
	return { code: result.exitCode, out: `${result.stdout.toString()}${result.stderr.toString()}` };
}

test("status --json lists the doc with completion", () => {
	const repo = setupRepo();
	const { code, out } = run(repo, ["status", "--json"]);
	expect(code).toBe(0);
	const parsed = JSON.parse(out) as Array<{
		slug: string;
		completion: { done: number; total: number };
	}>;
	expect(parsed[0]?.slug).toBe("2026-01-01-x");
	expect(parsed[0]?.completion).toEqual({ done: 1, total: 2 });
});

test("index writes INDEX.md", () => {
	const repo = setupRepo();
	expect(run(repo, ["index"]).code).toBe(0);
	expect(existsSync(join(repo, "docs", "plans", "INDEX.md"))).toBe(true);
});

test("check accepts an index generated before first commit of a plan", () => {
	const root = mkdtempSync(join(tmpdir(), "plans-cli-precommit-"));
	gitInit(root);
	mkdirSync(join(root, "docs", "plans"), { recursive: true });
	writeFileSync(
		join(root, "docs", "plans", "2026-01-03-precommit.md"),
		"---\ntitle: Precommit\ntype: plan\nstatus: active\ncreated: 2026-01-03\n---\n## Tasks\n- [ ] one\n",
	);
	expect(run(root, ["index"]).code).toBe(0);
	expect(run(root, ["check"]).code).toBe(0);

	Bun.spawnSync({ cmd: ["git", "add", "docs/plans"], cwd: root });
	Bun.spawnSync({ cmd: ["git", "commit", "-qm", "add plan"], cwd: root });

	const { code, out } = run(root, ["check"]);
	expect(out).not.toContain("stale-index");
	expect(code).toBe(0);
});

test("check fails on a dangling parent", () => {
	const repo = setupRepo();
	writeFileSync(
		join(repo, "docs", "plans", "2026-01-02-y.md"),
		"---\ntitle: Y\ntype: plan\nstatus: active\ncreated: 2026-01-02\nparent: ghost\n---\n",
	);
	run(repo, ["index"]);
	const { code, out } = run(repo, ["check"]);
	expect(code).toBe(1);
	expect(out).toContain("dangling-parent");
});

test("check and status no-op cleanly in a planless repo", () => {
	const root = mkdtempSync(join(tmpdir(), "plans-cli-empty-"));
	gitInit(root);
	expect(run(root, ["check"]).code).toBe(0);
	expect(run(root, ["status"]).code).toBe(0);
});

test("complete archives an implemented planning doc and refreshes the index", async () => {
	const repo = setupRepo();

	expect(run(repo, ["index"]).code).toBe(0);
	const { code, out } = run(repo, ["complete", "2026-01-01-x"]);

	expect(code).toBe(0);
	expect(out).toContain("archived docs/plans/archive/2026-01-01-x.md");
	expect(existsSync(join(repo, "docs", "plans", "2026-01-01-x.md"))).toBe(false);
	const archivePath = join(repo, "docs", "plans", "archive", "2026-01-01-x.md");
	expect(existsSync(archivePath)).toBe(true);
	const archived = await Bun.file(archivePath).text();
	expect(archived).toContain("status: implemented");
	expect(archived).toContain("archived: ");
	expect(run(repo, ["check"]).code).toBe(0);
	expect(run(repo, ["status", "--active"]).out).not.toContain("2026-01-01-x");
});

test("complete fails without mutating when the slug is missing", async () => {
	const repo = setupRepo();
	const planPath = join(repo, "docs", "plans", "2026-01-01-x.md");
	const before = await Bun.file(planPath).text();

	const { code, out } = run(repo, ["complete", "missing"]);

	expect(code).toBe(1);
	expect(out).toContain("no active planning doc found for slug: missing");
	expect(await Bun.file(planPath).text()).toBe(before);
});

test("--help exits 0", () => {
	expect(run(setupRepo(), ["--help"]).code).toBe(0);
});
