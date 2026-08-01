// Real IO for `bun run update-vendored-skill`: resolve the upstream default
// branch head, list its subtree, fetch every blob, and replace the vendored
// copy. Unauthenticated GitHub API + raw.githubusercontent.com, no token
// handling — this repo stores no credentials, so a 403 rate-limit surfaces
// as-is.

import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OptionalSkill } from "./optional-skills.ts";
import { selectSubtreeFiles, type TreeEntry } from "./vendored-skill-update.ts";

const API_HEADERS = {
	Accept: "application/vnd.github+json",
	// GitHub rejects API requests with no User-Agent.
	"User-Agent": "omp-agent-setup",
};

export interface VendoredSkillUpdateResult {
	name: string;
	oldCommit: string;
	newCommit: string;
	files: string[];
}

export async function updateVendoredSkill(options: {
	repoRoot: string;
	skill: OptionalSkill;
}): Promise<VendoredSkillUpdateResult> {
	const { repoRoot, skill } = options;
	const repoMeta = (await fetchJson(`https://api.github.com/repos/${skill.repo}`)) as {
		default_branch?: string;
	};
	const defaultBranch = repoMeta.default_branch;
	if (!defaultBranch) throw new Error(`no default branch reported for ${skill.repo}`);

	const head = (await fetchJson(
		`https://api.github.com/repos/${skill.repo}/commits/${defaultBranch}`,
	)) as { sha?: string };
	const newCommit = head.sha;
	if (!newCommit) throw new Error(`no commit sha reported for ${skill.repo}@${defaultBranch}`);

	const tree = (await fetchJson(
		`https://api.github.com/repos/${skill.repo}/git/trees/${newCommit}?recursive=1`,
	)) as { tree?: TreeEntry[]; truncated?: boolean };
	if (tree.truncated) {
		throw new Error(`subtree listing truncated for ${skill.repo}; vendor manually`);
	}
	const files = selectSubtreeFiles(tree.tree ?? [], skill.sourceDir);
	if (files.length === 0) {
		throw new Error(`no files under ${skill.sourceDir} at ${newCommit}`);
	}
	if (!files.includes("SKILL.md")) {
		throw new Error(`SKILL.md missing under ${skill.sourceDir} at ${newCommit}`);
	}

	const contents = new Map<string, ArrayBuffer>();
	for (const relative of files) {
		const url = `https://raw.githubusercontent.com/${skill.repo}/${newCommit}/${skill.sourceDir}/${relative}`;
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
		}
		contents.set(relative, await response.arrayBuffer());
	}

	// Upstream renaming the skill would silently break every repo that enabled
	// it: the payload directory name and the frontmatter name must agree or
	// OMP's project scan loads a skill nobody can address.
	const skillMd = new TextDecoder().decode(contents.get("SKILL.md"));
	if (!new RegExp(`^name:\\s*${skill.name}\\s*$`, "m").test(skillMd)) {
		throw new Error(`SKILL.md frontmatter name is not "${skill.name}" at ${newCommit}`);
	}

	const targetDir = join(repoRoot, "agent", "optional-skills", skill.name);
	await rm(targetDir, { recursive: true, force: true });
	for (const [relative, body] of contents) {
		const path = join(targetDir, relative);
		await mkdir(dirname(path), { recursive: true });
		await Bun.write(path, body);
	}

	return { name: skill.name, oldCommit: skill.commit, newCommit, files };
}

async function fetchJson(url: string): Promise<unknown> {
	const response = await fetch(url, { headers: API_HEADERS });
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
	}
	return await response.json();
}
