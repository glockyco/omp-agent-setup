/**
 * Skills deployed globally but discovered nowhere by default. Bootstrap links
 * each payload to `~/.omp/agent/optional-skills/<name>`, which OMP does not
 * scan: its native user scan is `~/.omp/agent/skills` and its auto-learn scan
 * is `~/.omp/agent/managed-skills`. A repository opts in with
 * `omp-skill enable <name>`, which symlinks the payload into
 * `<repo>/.omp/skills/<name>` where OMP's native project scan finds it.
 */
export interface OptionalSkill {
	/** Directory name; must equal the SKILL.md frontmatter `name`. */
	readonly name: string;
	/** GitHub `owner/repo` the payload is vendored from. */
	readonly repo: string;
	/** Directory inside that repo that holds `SKILL.md`. */
	readonly sourceDir: string;
	/** Upstream commit the vendored tree came from. */
	readonly commit: string;
}

export const LOCAL_OPTIONAL_SKILLS: readonly OptionalSkill[] = [
	{
		name: "simple-english",
		repo: "AminBlg/SimpleEnglish",
		sourceDir: "skills/simple-english",
		commit: "379728b51981b6d2ee1de0f201164483a9648972",
	},
];

/** Registry lookup by skill name. */
export function findOptionalSkill(name: string): OptionalSkill | undefined {
	return LOCAL_OPTIONAL_SKILLS.find(skill => skill.name === name);
}
