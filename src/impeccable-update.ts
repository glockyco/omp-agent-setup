import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
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

const PI_SCRIPT_PATH = ".pi/skills/impeccable";
// biome-ignore lint/suspicious/noTemplateCurlyInString: literal bash parameter expansion emitted into shell command docs, not a JS template
const DEPLOYED_SCRIPT_PATH = '"${OMP_AGENT_DIR:-$HOME/.omp/agent}"/skills/impeccable';

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
	await rewriteVendoredScriptPaths(destinationDir);

	return { oldVersion, newVersion };
}

/**
 * Upstream Impeccable installs per-project via `npx impeccable`, so its
 * SKILL.md and reference docs invoke scripts as
 * `node .pi/skills/impeccable/scripts/*.mjs` — a project-relative path. We
 * vendor the skill once and deploy it globally at
 * `$OMP_AGENT_DIR/skills/impeccable`, where that relative path resolves to
 * nothing in an arbitrary project cwd. Rewrite the invocations to the deployed
 * location: a `$HOME/.omp/agent` fallback covers sessions where the bootstrap
 * extension hasn't exported OMP_AGENT_DIR, and the quoting keeps paths with
 * spaces as a single shell word. Idempotent.
 */
export function rewriteImpeccableScriptPaths(text: string): string {
	return text.replaceAll(PI_SCRIPT_PATH, DEPLOYED_SCRIPT_PATH);
}

/** Apply {@link rewriteImpeccableScriptPaths} to every vendored `.md` doc. */
async function rewriteVendoredScriptPaths(skillDir: string): Promise<void> {
	const entries = await readdir(skillDir, { recursive: true, withFileTypes: true });
	await Promise.all(
		entries
			.filter(entry => entry.isFile() && entry.name.endsWith(".md"))
			.map(async entry => {
				const filePath = join(entry.parentPath, entry.name);
				const original = await readFile(filePath, "utf8");
				const rewritten = rewriteImpeccableScriptPaths(original);
				if (rewritten !== original) {
					await writeFile(filePath, rewritten);
				}
			}),
	);
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
