#!/usr/bin/env bun
// CLI entry for `omp-plans`: index | check | status, CWD-scoped onto
// ./docs/plans/. Only `index` mutates (writes INDEX.md). No-ops cleanly when
// docs/plans/ is absent. Deployed as a managed PATH bin by bootstrap.

import { readFileSync, writeFileSync } from "node:fs";
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
	"usage: omp-plans <index|check|status> [--active|--stale|--complete|--archive] [--json] [--fleet]";

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
