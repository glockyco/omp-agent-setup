// Pure logic for the `omp-plans` planning-doc tool: front-matter parsing,
// validation, scoped checkbox counting, status/staleness classification,
// cross-doc link integrity, and INDEX/status rendering. Real-IO (fs, git,
// config) lives in `plans-runtime.ts`. The split mirrors `lsp-audit.ts`:
// pure logic stays unit-testable, side effects stay one file away.

import { parse as parseYaml } from "yaml";

const DOC_TYPES = ["spec", "plan", "prd", "audit", "note"] as const;
const DOC_STATUSES = ["draft", "active", "implemented", "superseded", "abandoned"] as const;
type DocType = (typeof DOC_TYPES)[number];
type DocStatus = (typeof DOC_STATUSES)[number];

interface FrontMatter {
	title?: string;
	type?: string;
	status?: string;
	created?: string;
	parent?: string;
	superseded_by?: string;
	archived?: string;
}

export interface ParsedDoc {
	slug: string;
	frontMatter: FrontMatter;
	body: string;
	archived: boolean;
}

export interface DocError {
	slug: string;
	code: string;
	message: string;
}

export interface TaskCount {
	done: number;
	total: number;
}

export interface Thresholds {
	staleDays: number;
	archiveDeleteDays: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { staleDays: 60, archiveDeleteDays: 180 };

const FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/** Parse a doc's `slug` (basename without `.md`), YAML front-matter, and body. */
export function parseDoc(path: string, content: string, archived = false): ParsedDoc {
	const slug = path.replace(/^.*\//, "").replace(/\.md$/, "");
	const match = content.match(FRONT_MATTER_RE);
	if (!match) return { slug, frontMatter: {}, body: content, archived };
	const parsed = parseYaml(match[1] ?? "") as FrontMatter | null;
	return { slug, frontMatter: parsed ?? {}, body: match[2] ?? "", archived };
}

/** Schema/value validation for one doc's front-matter. */
export function validateDoc(doc: ParsedDoc): DocError[] {
	const errors: DocError[] = [];
	const fm = doc.frontMatter;
	const requireKey = (key: keyof FrontMatter, code: string): void => {
		if (!fm[key]) errors.push({ slug: doc.slug, code, message: `missing ${key}` });
	};
	requireKey("title", "missing-title");
	requireKey("type", "missing-type");
	requireKey("status", "missing-status");
	requireKey("created", "missing-created");
	if (fm.type && !DOC_TYPES.includes(fm.type as DocType)) {
		errors.push({ slug: doc.slug, code: "bad-type", message: `type=${fm.type}` });
	}
	if (fm.status && !DOC_STATUSES.includes(fm.status as DocStatus)) {
		errors.push({ slug: doc.slug, code: "bad-status", message: `status=${fm.status}` });
	}
	if (fm.status === "superseded" && !fm.superseded_by) {
		errors.push({
			slug: doc.slug,
			code: "missing-superseded_by",
			message: "superseded needs superseded_by",
		});
	}
	return errors;
}

/**
 * Count checkbox tasks, scoped to `## Tasks` / `### Task N` sections only.
 * Checkboxes inside fenced code blocks or illustrative lists elsewhere are
 * ignored, so example checklists never pollute the completion ratio.
 */
export function countTasks(body: string): TaskCount {
	let inFence = false;
	let inTaskSection = false;
	let done = 0;
	let total = 0;
	for (const line of body.split("\n")) {
		if (/^\s*```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		if (/^#{1,6}\s/.test(line)) {
			inTaskSection = /^##\s+Tasks\b/.test(line) || /^###\s+Task\s/i.test(line);
			continue;
		}
		if (!inTaskSection) continue;
		const match = line.match(/^\s*-\s+\[( |x|X)\]\s/);
		if (match) {
			total += 1;
			if (match[1]?.toLowerCase() === "x") done += 1;
		}
	}
	return { done, total };
}

export type DocFlag = "stale" | "complete" | "deletable";

export interface ClassifyInput {
	status: string | undefined;
	lastTouched: Date | null;
	tasks: TaskCount;
	archived: Date | null;
}

function daysBetween(later: Date, earlier: Date): number {
	return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

/** Derive report flags: stale-active, complete-active, deletable-archive. */
export function classifyDoc(
	input: ClassifyInput,
	now: Date,
	thresholds: Thresholds = DEFAULT_THRESHOLDS,
): { flags: DocFlag[] } {
	const flags: DocFlag[] = [];
	if (input.status === "active") {
		if (input.lastTouched && daysBetween(now, input.lastTouched) > thresholds.staleDays)
			flags.push("stale");
		if (input.tasks.total > 0 && input.tasks.done === input.tasks.total) flags.push("complete");
	}
	if (input.archived && daysBetween(now, input.archived) > thresholds.archiveDeleteDays)
		flags.push("deletable");
	return { flags };
}

/** Flag `parent`/`superseded_by` references that do not resolve to a present doc. */
export function validateLinks(docs: readonly ParsedDoc[]): DocError[] {
	const slugs = new Set(docs.map(doc => doc.slug));
	const errors: DocError[] = [];
	for (const doc of docs) {
		const { parent, superseded_by: supersededBy } = doc.frontMatter;
		if (parent && !slugs.has(parent)) {
			errors.push({ slug: doc.slug, code: "dangling-parent", message: `parent=${parent}` });
		}
		if (supersededBy && !slugs.has(supersededBy)) {
			errors.push({
				slug: doc.slug,
				code: "dangling-superseded_by",
				message: `superseded_by=${supersededBy}`,
			});
		}
	}
	return errors;
}

export interface DocRow {
	slug: string;
	frontMatter: FrontMatter;
	lastTouched: Date | null;
	tasks: TaskCount;
	archived: Date | null;
	flags: DocFlag[];
}

const STATUS_RANK: Record<string, number> = {
	active: 0,
	draft: 1,
	implemented: 2,
	superseded: 3,
	abandoned: 4,
};

function sortRows(rows: readonly DocRow[]): DocRow[] {
	return [...rows].sort((a, b) => {
		const rankA = STATUS_RANK[a.frontMatter.status ?? ""] ?? 9;
		const rankB = STATUS_RANK[b.frontMatter.status ?? ""] ?? 9;
		return rankA - rankB || a.slug.localeCompare(b.slug);
	});
}

function isoDate(date: Date | null): string {
	return date ? date.toISOString().slice(0, 10) : "—";
}

/** Render `INDEX.md`: active/draft grouped by status; archive excluded (linked). */
export function renderIndex(rows: readonly DocRow[]): string {
	const visible = sortRows(rows.filter(row => !row.archived));
	const archivedCount = rows.length - visible.length;
	const lines: string[] = ["# Planning Index", ""];
	let lastStatus = "";
	for (const row of visible) {
		const status = row.frontMatter.status ?? "?";
		if (status !== lastStatus) {
			lines.push(`## ${status}`, "");
			lastStatus = status;
		}
		const parent = row.frontMatter.parent ? ` ← ${row.frontMatter.parent}` : "";
		const ratio = row.tasks.total === 0 ? "—" : `${row.tasks.done}/${row.tasks.total}`;
		const tasks = row.frontMatter.type === "plan" ? ` (${ratio})` : "";
		const title = row.frontMatter.title ?? row.slug;
		lines.push(
			`- **${title}** [${row.frontMatter.type ?? "?"}] \`${row.slug}\`${tasks} — ${isoDate(row.lastTouched)}${parent}`,
		);
	}
	if (archivedCount > 0)
		lines.push("", `_${archivedCount} archived — see \`docs/plans/archive/\`._`);
	return `${lines.join("\n")}\n`;
}

/** Render the `status` query: a stable table, or JSON when `opts.json`. */
export function renderStatus(rows: readonly DocRow[], opts: { json?: boolean } = {}): string {
	if (opts.json) {
		return JSON.stringify(
			sortRows(rows).map(row => ({
				slug: row.slug,
				type: row.frontMatter.type ?? null,
				status: row.frontMatter.status ?? null,
				completion: row.frontMatter.type === "plan" ? row.tasks : null,
				lastTouched: isoDate(row.lastTouched),
				archived: isoDate(row.archived),
				flags: row.flags,
			})),
			null,
			2,
		);
	}
	const lines = sortRows(rows).map(row => {
		const flags = row.flags.length ? ` [${row.flags.join(",")}]` : "";
		const status = (row.frontMatter.status ?? "?").padEnd(12);
		const type = (row.frontMatter.type ?? "?").padEnd(6);
		const ratio = row.tasks.total === 0 ? "—" : `${row.tasks.done}/${row.tasks.total}`;
		return `${status} ${type} ${ratio.padEnd(6)} ${isoDate(row.lastTouched)}  ${row.slug}${flags}`;
	});
	return `${lines.join("\n")}\n`;
}

/**
 * Pick the most recent "real" commit date from a `git log` rendered as
 * `%cI\x1f%s` lines, skipping commits whose subject contains `[docs-skip]`
 * (metadata-only touches that should not reset freshness).
 */
export function pickLastTouched(gitLog: string): Date | null {
	for (const line of gitLog.split("\n")) {
		if (!line.trim()) continue;
		const [iso, subject = ""] = line.split("\x1f");
		if (subject.includes("[docs-skip]")) continue;
		const date = new Date(iso ?? "");
		if (!Number.isNaN(date.getTime())) return date;
	}
	return null;
}

/** Merge top-level `stale_days`/`archive_delete_days` from `plans.toml` over a base. */
export function parseThresholds(toml: string, base: Thresholds): Thresholds {
	const stale = toml.match(/^\s*stale_days\s*=\s*(\d+)/m);
	const archive = toml.match(/^\s*archive_delete_days\s*=\s*(\d+)/m);
	return {
		staleDays: stale?.[1] ? Number.parseInt(stale[1], 10) : base.staleDays,
		archiveDeleteDays: archive?.[1] ? Number.parseInt(archive[1], 10) : base.archiveDeleteDays,
	};
}
