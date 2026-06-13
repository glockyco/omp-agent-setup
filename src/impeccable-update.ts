import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

export interface UpdateImpeccableOptions {
	repoRoot: string;
	bundleRoot: string;
}

export interface UpdateImpeccableResult {
	oldVersion: string | null;
	newVersion: string;
}

const PI_IMPECCABLE_RELATIVE = [".pi", "skills", "impeccable"] as const;
const VENDORED_IMPECCABLE_RELATIVE = ["agent", "skills", "impeccable"] as const;

export async function updateImpeccableFromBundle(
	options: UpdateImpeccableOptions,
): Promise<UpdateImpeccableResult> {
	const sourceDir = join(options.bundleRoot, ...PI_IMPECCABLE_RELATIVE);
	const destinationDir = join(options.repoRoot, ...VENDORED_IMPECCABLE_RELATIVE);
	const sourceSkill = join(sourceDir, "SKILL.md");
	const destinationSkill = join(destinationDir, "SKILL.md");

	let sourceText: string;
	try {
		sourceText = await readFile(sourceSkill, "utf8");
	} catch (error) {
		throw new Error(`Bundle does not contain the Pi impeccable skill at ${sourceDir}`, {
			cause: error,
		});
	}

	const newVersion = readVersion(sourceText);
	if (!newVersion) {
		throw new Error(`Pi impeccable skill SKILL.md is missing a version field: ${sourceSkill}`);
	}

	const oldVersion = await readExistingVersion(destinationSkill);
	await mkdir(join(options.repoRoot, "agent", "skills"), { recursive: true });
	await rm(destinationDir, { recursive: true, force: true });
	await cp(sourceDir, destinationDir, { recursive: true });

	return { oldVersion, newVersion };
}

async function readExistingVersion(skillPath: string): Promise<string | null> {
	try {
		return readVersion(await readFile(skillPath, "utf8"));
	} catch {
		return null;
	}
}

function readVersion(text: string): string | null {
	const match = /^version:\s*["']?([^"'\n]+)["']?\s*$/m.exec(text);
	return match?.[1]?.trim() || null;
}
