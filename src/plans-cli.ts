#!/usr/bin/env bun
// CLI entry for `omp-plans`: index | check | status | complete, CWD-scoped
// onto ./docs/plans/. `index` writes INDEX.md; `complete` archives one doc and
// rewrites INDEX.md. No-ops cleanly when docs/plans/ is absent.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { discoverRepos } from "./lsp-audit-runtime.ts";
import {
	type DocError,
	type DocRow,
	renderIndex,
	renderStatus,
	validateDoc,
	validateLinks,
} from "./plans.ts";
import { loadDocRows, resolveRepoRoot } from "./plans-runtime.ts";

const FILTERS = ["active", "stale", "complete", "archive"] as const;
type Filter = (typeof FILTERS)[number];

function filterRows(rows: readonly DocRow[], filter: Filter | null): DocRow[] {
	switch (filter) {
		case "active":
			return rows.filter(row => row.frontMatter.status === "active" && !row.archived);
		case "stale":
			return rows.filter(row => row.flags.includes("stale"));
		case "complete":
			return rows.filter(row => row.flags.includes("complete"));
		case "archive":
			return rows.filter(row => row.archived !== null);
		default:
			return rows.filter(row => !row.archived);
	}
}

function cmdIndex(repoRoot: string, now: Date): number {
	const { rows } = loadDocRows(repoRoot, now);
	if (rows.length === 0) {
		console.log("no docs/plans/ — nothing to index");
		return 0;
	}
	writeFileSync(join(repoRoot, "docs", "plans", "INDEX.md"), renderIndex(rows));
	console.log(`wrote docs/plans/INDEX.md (${rows.length} docs)`);
	return 0;
}

function cmdCheck(repoRoot: string, now: Date): number {
	const { docs, rows } = loadDocRows(repoRoot, now);
	if (docs.length === 0) return 0;
	const errors: DocError[] = [...docs.flatMap(validateDoc), ...validateLinks(docs)];
	let actualIndex = "";
	try {
		actualIndex = readFileSync(join(repoRoot, "docs", "plans", "INDEX.md"), "utf8");
	} catch {
		actualIndex = "";
	}
	if (actualIndex !== renderIndex(rows)) {
		errors.push({ slug: "INDEX.md", code: "stale-index", message: "run `omp-plans index`" });
	}
	if (errors.length > 0) {
		for (const error of errors) console.error(`✗ ${error.slug}: ${error.code} (${error.message})`);
		return 1;
	}
	console.log(`ok (${docs.length} docs)`);
	return 0;
}

function markImplemented(content: string, archivedDate: string): string | null {
	if (!content.startsWith("---\n")) return null;
	const end = content.indexOf("\n---", 4);
	if (end === -1) return null;
	const frontMatter = content.slice(4, end);
	const body = content.slice(end);
	if (!/^status:\s*active\s*$/m.test(frontMatter)) return null;
	let nextFrontMatter = frontMatter.replace(/^status:.*$/m, "status: implemented");
	if (/^archived:.*$/m.test(nextFrontMatter)) {
		nextFrontMatter = nextFrontMatter.replace(/^archived:.*$/m, `archived: ${archivedDate}`);
	} else {
		nextFrontMatter = `${nextFrontMatter}\narchived: ${archivedDate}`;
	}
	return `---\n${nextFrontMatter}${body}`;
}

function cmdComplete(repoRoot: string, now: Date, slug: string | undefined): number {
	if (!slug) {
		console.error("usage: omp-plans complete <slug>");
		return 1;
	}
	const plansDir = join(repoRoot, "docs", "plans");
	const sourcePath = join(plansDir, `${slug}.md`);
	let content = "";
	try {
		content = readFileSync(sourcePath, "utf8");
	} catch {
		console.error(`no active planning doc found for slug: ${slug}`);
		return 1;
	}
	const archivedDate = now.toISOString().slice(0, 10);
	const updated = markImplemented(content, archivedDate);
	if (updated === null) {
		console.error(`no active planning doc found for slug: ${slug}`);
		return 1;
	}
	writeFileSync(sourcePath, updated);
	const archiveDir = join(plansDir, "archive");
	mkdirSync(archiveDir, { recursive: true });
	const archivePath = join(archiveDir, `${slug}.md`);
	renameSync(sourcePath, archivePath);
	console.log(`archived docs/plans/archive/${slug}.md`);
	const indexCode = cmdIndex(repoRoot, now);
	if (indexCode !== 0) return indexCode;
	return cmdCheck(repoRoot, now);
}

function cmdStatus(
	repoRoot: string,
	now: Date,
	filter: Filter | null,
	json: boolean,
	fleet: boolean,
): number {
	if (!fleet) {
		const { rows } = loadDocRows(repoRoot, now);
		process.stdout.write(renderStatus(filterRows(rows, filter), { json }));
		return 0;
	}
	const repos = discoverRepos({ projectsDir: join(homedir(), "Projects") });
	const fleetJson: Record<string, unknown> = {};
	for (const repo of repos) {
		const { rows } = loadDocRows(repo.path, now);
		const filtered = filterRows(rows, filter);
		if (filtered.length === 0) continue;
		if (json) {
			fleetJson[repo.label] = JSON.parse(renderStatus(filtered, { json: true }));
		} else {
			console.log(`# ${repo.label}`);
			process.stdout.write(renderStatus(filtered, { json: false }));
			console.log("");
		}
	}
	if (json) console.log(JSON.stringify(fleetJson, null, 2));
	return 0;
}

const USAGE =
	"usage: omp-plans <index|check|status|complete> [slug] [--active|--stale|--complete|--archive] [--json] [--fleet]";

function main(argv: readonly string[]): number {
	const sub = argv[0];
	const flags = new Set(argv.slice(1).filter(arg => arg.startsWith("--")));
	const filter = FILTERS.find(name => flags.has(`--${name}`)) ?? null;
	const now = new Date();
	const repoRoot = resolveRepoRoot(process.cwd());
	switch (sub) {
		case "index":
			return cmdIndex(repoRoot, now);
		case "check":
			return cmdCheck(repoRoot, now);
		case "status":
			return cmdStatus(repoRoot, now, filter, flags.has("--json"), flags.has("--fleet"));
		case "complete":
			return cmdComplete(repoRoot, now, argv[1]);
		default:
			if (sub && sub !== "--help" && sub !== "-h") {
				console.error(USAGE);
				return 1;
			}
			console.log(USAGE);
			return 0;
	}
}

if (import.meta.main) {
	process.exit(main(Bun.argv.slice(2)));
}
