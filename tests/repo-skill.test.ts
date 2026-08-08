import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	addExcludeLine,
	classifyRepoSkill,
	EXCLUDE_HEADER,
	isDeployedOptionalSkill,
	planRepoSkillDisable,
	planRepoSkillEnable,
	type RepoSkillEntry,
	removeExcludeLine,
	repoSkillExcludeLine,
	repoSkillPath,
} from "../src/repo-skill.ts";

const REPO = "/tmp/some-repo";
const NAME = "simple-english";
const PAYLOAD = "/Users/x/.omp/agent/optional-skills/simple-english";
const DEST = join(REPO, ".omp", "skills", NAME);

function input(entry: RepoSkillEntry) {
	return { repoRoot: REPO, name: NAME, payloadDir: PAYLOAD, entry };
}

const ENTRIES: Array<[label: string, entry: RepoSkillEntry]> = [
	["absent", null],
	["our symlink", { isSymlink: true, target: PAYLOAD }],
	["foreign symlink", { isSymlink: true, target: "/somewhere/else" }],
	["real directory", { isSymlink: false, target: null }],
];

describe("repoSkillPath", () => {
	test("targets the directory OMP's native project scan reads", () => {
		expect(repoSkillPath(REPO, NAME)).toBe(DEST);
	});
});

describe("planRepoSkillEnable", () => {
	test("links when nothing is there", () => {
		expect(planRepoSkillEnable(input(null))).toEqual({
			kind: "link",
			source: PAYLOAD,
			destination: DEST,
		});
	});

	test("is a no-op when our symlink already points at the payload", () => {
		expect(planRepoSkillEnable(input({ isSymlink: true, target: PAYLOAD }))).toEqual({
			kind: "skip-already-enabled",
			destination: DEST,
		});
	});

	test("refuses a foreign symlink", () => {
		expect(planRepoSkillEnable(input({ isSymlink: true, target: "/somewhere/else" }))).toEqual({
			kind: "blocked-foreign",
			destination: DEST,
			target: "/somewhere/else",
		});
	});

	test("refuses a real directory", () => {
		expect(planRepoSkillEnable(input({ isSymlink: false, target: null }))).toEqual({
			kind: "blocked-foreign",
			destination: DEST,
			target: null,
		});
	});
});

describe("planRepoSkillDisable", () => {
	test("is a no-op when nothing is there", () => {
		expect(planRepoSkillDisable(input(null))).toEqual({
			kind: "skip-not-enabled",
			destination: DEST,
		});
	});

	test("unlinks our own symlink", () => {
		expect(planRepoSkillDisable(input({ isSymlink: true, target: PAYLOAD }))).toEqual({
			kind: "unlink",
			destination: DEST,
		});
	});

	test.each(ENTRIES.slice(2))("refuses to remove a %s", (_label, entry) => {
		expect(planRepoSkillDisable(input(entry)).kind).toBe("blocked-foreign");
	});
});

describe("classifyRepoSkill", () => {
	test("reports disabled when nothing is there", () => {
		expect(classifyRepoSkill({ entry: null, payloadDir: PAYLOAD, payloadExists: true })).toBe(
			"disabled",
		);
	});

	test("reports enabled when our symlink resolves", () => {
		expect(
			classifyRepoSkill({
				entry: { isSymlink: true, target: PAYLOAD },
				payloadDir: PAYLOAD,
				payloadExists: true,
			}),
		).toBe("enabled");
	});

	test("reports broken when our symlink survives a removed payload", () => {
		expect(
			classifyRepoSkill({
				entry: { isSymlink: true, target: PAYLOAD },
				payloadDir: PAYLOAD,
				payloadExists: false,
			}),
		).toBe("broken");
	});

	test.each(ENTRIES.slice(2))("reports foreign for a %s", (_label, entry) => {
		expect(classifyRepoSkill({ entry, payloadDir: PAYLOAD, payloadExists: true })).toBe("foreign");
	});
});

describe("isDeployedOptionalSkill", () => {
	const root = "/Users/x/.omp/agent/optional-skills";

	test("claims a symlink into the deploy root", () => {
		expect(isDeployedOptionalSkill(`${root}/simple-english`, root)).toBe(true);
	});

	test("disowns a repository's own real skill directory", () => {
		expect(isDeployedOptionalSkill(null, root)).toBe(false);
	});

	test("disowns a symlink pointing somewhere else entirely", () => {
		expect(isDeployedOptionalSkill("/Users/x/Projects/foo/skills/bar", root)).toBe(false);
	});

	test("does not match a sibling root sharing the prefix", () => {
		expect(isDeployedOptionalSkill(`${root}-backup/simple-english`, root)).toBe(false);
	});

	test("does not match the deploy root itself", () => {
		expect(isDeployedOptionalSkill(root, root)).toBe(false);
	});
});

describe("git exclude maintenance", () => {
	const line = repoSkillExcludeLine(NAME);

	test("anchors the exclude line at the repo root", () => {
		expect(line).toBe("/.omp/skills/simple-english");
	});

	test("writes header and line into empty text", () => {
		expect(addExcludeLine("", line)).toBe(`${EXCLUDE_HEADER}\n${line}\n`);
	});

	test("is idempotent", () => {
		const once = addExcludeLine("", line);
		expect(addExcludeLine(once, line)).toBe(once);
	});

	test("appends after existing content without a second header", () => {
		const text = addExcludeLine("build/\n", line);
		expect(text).toBe(`build/\n${EXCLUDE_HEADER}\n${line}\n`);
		expect(addExcludeLine(text, line)).toBe(text);
	});

	test("removes the line and the now-orphaned header, keeping other content", () => {
		const text = addExcludeLine("build/\n", line);
		expect(removeExcludeLine(text, line)).toBe("build/\n");
	});

	test("empties a file that held nothing else", () => {
		expect(removeExcludeLine(addExcludeLine("", line), line)).toBe("");
	});

	test("keeps the header while another optional skill remains", () => {
		const text = addExcludeLine(addExcludeLine("", line), "/.omp/skills/other");
		expect(removeExcludeLine(text, line)).toBe(`${EXCLUDE_HEADER}\n/.omp/skills/other\n`);
	});

	test("is a no-op on text that never had the line", () => {
		expect(removeExcludeLine("build/\n", line)).toBe("build/\n");
	});
});
