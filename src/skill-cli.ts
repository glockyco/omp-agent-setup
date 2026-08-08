#!/usr/bin/env bun
// CLI entry for `omp-skill`: list | enable | disable, CWD-scoped onto the
// containing repository. Optional skills are deployed globally but discovered
// nowhere by default; enabling one symlinks the deployed payload into
// `<repo>/.omp/skills/<name>` and excludes it via `.git/info/exclude`, so the
// opt-in is machine-local and leaves the working tree clean. Enabled state is
// discovered from the filesystem, never tracked.

import { homedir } from "node:os";
import { join } from "node:path";
import { discoverRepos } from "./lsp-audit-runtime.ts";
import { findOptionalSkill, LOCAL_OPTIONAL_SKILLS } from "./optional-skills.ts";
import { resolveRepoRoot } from "./plans-runtime.ts";
import {
	addExcludeLine,
	classifyRepoSkill,
	isDeployedOptionalSkill,
	planRepoSkillDisable,
	planRepoSkillEnable,
	type RepoSkillStatus,
	removeExcludeLine,
	repoSkillExcludeLine,
	repoSkillPath,
} from "./repo-skill.ts";
import {
	applyDisablePlan,
	applyEnablePlan,
	type ExcludeResult,
	listRepoSkillEntries,
	optionalSkillPayloadDir,
	optionalSkillsRoot,
	payloadExists,
	probeRepoSkillEntry,
	updateGitExclude,
} from "./repo-skill-runtime.ts";

const USAGE = "usage: omp-skill <list|enable|disable> [name] [--fleet]";

function knownNames(): string {
	return LOCAL_OPTIONAL_SKILLS.map(skill => skill.name).join(", ");
}

/** One rendered `list` row, plus whether it counts as a problem. */
interface SkillRow {
	status: RepoSkillStatus | "orphan";
	line: string;
}

/** Probe every registry entry plus every orphan under `<repoRoot>/.omp/skills`. */
async function collectRows(repoRoot: string): Promise<SkillRow[]> {
	const rows: SkillRow[] = [];
	for (const skill of LOCAL_OPTIONAL_SKILLS) {
		const payloadDir = optionalSkillPayloadDir(skill.name);
		const entry = await probeRepoSkillEntry(repoSkillPath(repoRoot, skill.name));
		const status = classifyRepoSkill({
			entry,
			payloadDir,
			payloadExists: await payloadExists(payloadDir),
		});
		rows.push({ status, line: renderRow(status, skill.name, entry?.target ?? null, payloadDir) });
	}
	const registered = new Set(LOCAL_OPTIONAL_SKILLS.map(skill => skill.name));
	const deployRoot = optionalSkillsRoot();
	for (const entry of await listRepoSkillEntries(repoRoot)) {
		// Only a symlink we planted can be stranded by a registry deletion. A
		// repository's own `.omp/skills/<name>` directory is not ours to report.
		if (registered.has(entry.name) || !isDeployedOptionalSkill(entry.target, deployRoot)) continue;
		rows.push({
			status: "orphan",
			line: `  orphan     ${entry.name}  (not in LOCAL_OPTIONAL_SKILLS; remove ${repoSkillPath(repoRoot, entry.name)})`,
		});
	}
	return rows;
}

function renderRow(
	status: RepoSkillStatus,
	name: string,
	target: string | null,
	payloadDir: string,
): string {
	switch (status) {
		case "enabled":
			return `  enabled    ${name}  -> ${payloadDir}`;
		case "disabled":
			return `  disabled   ${name}`;
		case "broken":
			return `  broken     ${name}  -> ${target ?? payloadDir} (payload missing; run 'omp-skill disable ${name}')`;
		case "foreign":
			return `  foreign    ${name}  -> ${target ?? "not a symlink"}`;
	}
}

async function cmdList(repoRoot: string): Promise<number> {
	console.log(`repo: ${repoRoot}`);
	const rows = await collectRows(repoRoot);
	for (const row of rows) console.log(row.line);
	return rows.some(row => row.status !== "enabled" && row.status !== "disabled") ? 1 : 0;
}

async function cmdListFleet(): Promise<number> {
	const repos = discoverRepos({ projectsDir: join(homedir(), "Projects") });
	const counts: Record<SkillRow["status"], number> = {
		enabled: 0,
		disabled: 0,
		broken: 0,
		foreign: 0,
		orphan: 0,
	};
	let printed = 0;
	for (const repo of repos) {
		const rows = (await collectRows(repo.path)).filter(row => row.status !== "disabled");
		if (rows.length === 0) continue;
		console.log(`# ${repo.label}`);
		for (const row of rows) {
			console.log(row.line);
			counts[row.status]++;
		}
		printed += rows.length;
	}
	if (printed === 0) {
		console.log(`no repo has an optional skill enabled (of ${repos.length} scanned)`);
		return 0;
	}
	console.log(
		`${counts.enabled} repo(s) enabled, ${counts.broken} broken, ${counts.foreign} foreign, ${counts.orphan} orphan (of ${repos.length} scanned)`,
	);
	return counts.broken + counts.foreign + counts.orphan > 0 ? 1 : 0;
}

function describeExclude(result: ExcludeResult, verb: "added" | "removed", line: string): string {
	switch (result.kind) {
		case "changed":
			return `  git exclude: ${verb} ${line}`;
		case "unchanged":
			return `  git exclude: ${verb === "added" ? "already present" : "already absent"}`;
		case "no-git":
			return "  git exclude: skipped (no git dir)";
	}
}

async function cmdEnable(repoRoot: string, name: string | undefined): Promise<number> {
	const skill = name ? findOptionalSkill(name) : undefined;
	if (!skill) {
		console.error(`unknown optional skill: ${name ?? ""} (known: ${knownNames()})`);
		return 2;
	}
	const payloadDir = optionalSkillPayloadDir(skill.name);
	if (!(await payloadExists(payloadDir))) {
		console.error(`payload missing: ${payloadDir} — run 'bun run bootstrap' in omp-agent-setup`);
		return 1;
	}
	const plan = planRepoSkillEnable({
		repoRoot,
		name: skill.name,
		payloadDir,
		entry: await probeRepoSkillEntry(repoSkillPath(repoRoot, skill.name)),
	});
	if (plan.kind === "blocked-foreign") {
		console.error(`refusing to replace ${plan.destination} (not a managed symlink)`);
		return 1;
	}
	if (plan.kind === "skip-already-enabled") {
		console.log(`already enabled: ${skill.name}`);
		return 0;
	}
	await applyEnablePlan(plan);
	const line = repoSkillExcludeLine(skill.name);
	const exclude = await updateGitExclude(repoRoot, text => addExcludeLine(text, line));
	console.log(`enabled ${skill.name} -> ${payloadDir}`);
	console.log(`  repo: ${repoRoot}`);
	console.log(describeExclude(exclude, "added", line));
	console.log("Start a new OMP session in this repo to pick it up.");
	return 0;
}

async function cmdDisable(repoRoot: string, name: string | undefined): Promise<number> {
	const skill = name ? findOptionalSkill(name) : undefined;
	if (!skill) {
		console.error(`unknown optional skill: ${name ?? ""} (known: ${knownNames()})`);
		return 2;
	}
	const plan = planRepoSkillDisable({
		repoRoot,
		name: skill.name,
		payloadDir: optionalSkillPayloadDir(skill.name),
		entry: await probeRepoSkillEntry(repoSkillPath(repoRoot, skill.name)),
	});
	if (plan.kind === "blocked-foreign") {
		console.error(`refusing to replace ${plan.destination} (not a managed symlink)`);
		return 1;
	}
	if (plan.kind === "skip-not-enabled") {
		console.log(`not enabled: ${skill.name}`);
		return 0;
	}
	await applyDisablePlan(plan);
	const line = repoSkillExcludeLine(skill.name);
	const exclude = await updateGitExclude(repoRoot, text => removeExcludeLine(text, line));
	console.log(`disabled ${skill.name}`);
	console.log(describeExclude(exclude, "removed", line));
	return 0;
}

async function main(argv: readonly string[]): Promise<number> {
	const sub = argv[0];
	const flags = new Set(argv.filter(arg => arg.startsWith("--")));
	const name = argv.slice(1).find(arg => !arg.startsWith("--"));
	switch (sub) {
		case "list":
			return flags.has("--fleet")
				? await cmdListFleet()
				: await cmdList(resolveRepoRoot(process.cwd()));
		case "enable":
		case "disable": {
			if (flags.has("--fleet")) {
				console.error("--fleet is only valid for list");
				return 2;
			}
			const repoRoot = resolveRepoRoot(process.cwd());
			return sub === "enable" ? await cmdEnable(repoRoot, name) : await cmdDisable(repoRoot, name);
		}
		default:
			if (sub && sub !== "--help" && sub !== "-h") {
				console.error(`unknown command: ${sub}`);
				return 2;
			}
			console.log(USAGE);
			return sub ? 0 : 1;
	}
}

if (import.meta.main) {
	process.exit(await main(Bun.argv.slice(2)));
}
