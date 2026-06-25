// Real-IO adapters for `plans.ts`: target-repo resolution, doc discovery, git
// last-touched, threshold config, and DocRow composition. Not unit-tested
// directly; the pure logic in `plans.ts` is what we cover. Mirrors the
// `lsp-audit.ts` / `lsp-audit-runtime.ts` split.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	classifyDoc,
	countTasks,
	DEFAULT_THRESHOLDS,
	type DocRow,
	type ParsedDoc,
	parseDoc,
	parseThresholds,
	pickLastTouched,
	type Thresholds,
} from "./plans.ts";

const PLANS_REL = join("docs", "plans");

/** Resolve the git toplevel for `cwd`, falling back to `cwd` itself. */
export function resolveRepoRoot(cwd: string): string {
	const result = Bun.spawnSync({
		cmd: ["git", "-C", cwd, "rev-parse", "--show-toplevel"],
		stdout: "pipe",
		stderr: "ignore",
	});
	const top = result.exitCode === 0 ? result.stdout.toString().trim() : "";
	return top || cwd;
}

/** Discover `docs/plans/*.md` (+ `archive/*.md`); empty when the dir is absent. */
function discoverDocs(repoRoot: string): ParsedDoc[] {
	const plansDir = join(repoRoot, PLANS_REL);
	if (!existsSync(plansDir)) return [];
	const docs: ParsedDoc[] = [];
	const readDir = (dir: string, archived: boolean): void => {
		for (const name of readdirSync(dir)) {
			if (!name.endsWith(".md") || name === "INDEX.md") continue;
			docs.push(parseDoc(name, readFileSync(join(dir, name), "utf8"), archived));
		}
	};
	readDir(plansDir, false);
	const archiveDir = join(plansDir, "archive");
	if (existsSync(archiveDir)) readDir(archiveDir, true);
	return docs;
}

/** Last commit date touching the doc, ignoring `[docs-skip]` commits. */
function gitLastTouched(repoRoot: string, doc: ParsedDoc): Date | null {
	const rel = join(PLANS_REL, doc.archived ? "archive" : "", `${doc.slug}.md`);
	const result = Bun.spawnSync({
		cmd: ["git", "-C", repoRoot, "log", "--format=%cI%x1f%s", "--", rel],
		stdout: "pipe",
		stderr: "ignore",
	});
	if (result.exitCode !== 0) return null;
	return pickLastTouched(result.stdout.toString());
}

/** Thresholds = defaults merged with optional `docs/plans/plans.toml`. */
function loadThresholds(repoRoot: string): Thresholds {
	const tomlPath = join(repoRoot, PLANS_REL, "plans.toml");
	if (!existsSync(tomlPath)) return DEFAULT_THRESHOLDS;
	return parseThresholds(readFileSync(tomlPath, "utf8"), DEFAULT_THRESHOLDS);
}

/** Compose docs + DocRows for the CLI: discover → count → git date → classify. */
export function loadDocRows(repoRoot: string, now: Date): { docs: ParsedDoc[]; rows: DocRow[] } {
	const docs = discoverDocs(repoRoot);
	const thresholds = loadThresholds(repoRoot);
	const rows = docs.map(doc => {
		const tasks = countTasks(doc.body);
		const lastTouched = gitLastTouched(repoRoot, doc);
		const parsedArchived = doc.frontMatter.archived ? new Date(doc.frontMatter.archived) : null;
		const archived =
			parsedArchived && !Number.isNaN(parsedArchived.getTime()) ? parsedArchived : null;
		const { flags } = classifyDoc(
			{ status: doc.frontMatter.status, lastTouched, tasks, archived },
			now,
			thresholds,
		);
		return { slug: doc.slug, frontMatter: doc.frontMatter, lastTouched, tasks, archived, flags };
	});
	return { docs, rows };
}
