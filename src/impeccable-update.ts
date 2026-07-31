import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { planPatch, type SourceEdit } from "./patches.ts";

export interface UpdateImpeccableOptions {
	repoRoot: string;
	bundleRoot: string;
}

/**
 * A source edit re-applied to the vendored skill on every re-vendor, addressed
 * by path inside `agent/skills/impeccable/`.
 */
export interface VendorFix extends SourceEdit {
	/** Path inside the vendored skill directory, POSIX style. */
	targetRelative: string;
}

/** What happened to one {@link VendorFix} during a re-vendor. */
export interface VendorFixOutcome {
	id: string;
	kind: "apply" | "skip-already-applied" | "skip-anchor-missing" | "skip-target-missing";
}

export interface UpdateImpeccableResult {
	oldVersion: string | null;
	newVersion: string;
	/** One entry per {@link IMPECCABLE_VENDOR_FIXES} entry, in declaration order. */
	fixes: VendorFixOutcome[];
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
	const fixes = await applyVendorFixes(destinationDir);
	await assertPiImpeccableVariant(destinationDir);

	return { oldVersion, newVersion, fixes };
}

/**
 * Make `concept-seed.mjs` detect direct invocation through a symlinked skill
 * directory. We deploy the vendored skill as a symlink
 * (`~/.omp/agent/skills/impeccable` -> this repo), and Node resolves
 * `import.meta.url` to the real file while `process.argv[1]` keeps the symlink
 * path the agent typed. Upstream's plain `resolve()` compare therefore never
 * matches for us: the CLI block is skipped, the script writes nothing and exits
 * 0, and a design roll silently produces no seed. Upstream already guards this
 * exact hazard with realpath compares in `context.mjs`, `context-signals.mjs`,
 * `doctor.mjs`, `surface-brief.mjs`, and `critique-storage.mjs` — this fix
 * brings the outlier in line rather than inventing a new idiom.
 *
 * Two edits because the script imports no `node:fs` binding of its own.
 */
const CONCEPT_SEED_FS_IMPORT: VendorFix = {
	id: "concept-seed-fs-import",
	targetRelative: "scripts/concept-seed.mjs",
	description: "Import realpathSync for the concept-seed main-module guard.",
	anchor: [
		"import crypto from 'node:crypto';",
		"import { dirname, join, resolve } from 'node:path';",
	].join("\n"),
	replacement: [
		"import crypto from 'node:crypto';",
		"import { realpathSync } from 'node:fs';",
		"import { dirname, join, resolve } from 'node:path';",
	].join("\n"),
	appliedSignature: "import { realpathSync } from 'node:fs';",
};

const IMPECCABLE_OMP_HOOK_DETECTION: VendorFix = {
	id: "omp-hook-detection",
	targetRelative: "scripts/context.mjs",
	description: "Recognize the managed OMP design hook without a provider manifest.",
	anchor: [
		"  const activeRoot = path.resolve(ctx.projectRoot || process.cwd());",
		"  if (!hookEnabledAt(activeRoot)) return 'none';",
		"  const manifests = HOOK_MANIFESTS_BY_PROVIDER[IMPECCABLE_PROVIDER_ID] || [];",
	].join("\n"),
	replacement: [
		"  const activeRoot = path.resolve(ctx.projectRoot || process.cwd());",
		"  if (!hookEnabledAt(activeRoot)) return 'none';",
		"  // OMP wires hook-lib.mjs through a global extension rather than a project manifest.",
		"  if (truthyEnv(process.env.IMPECCABLE_OMP_HOOK)) return 'stop';",
		"  const manifests = HOOK_MANIFESTS_BY_PROVIDER[IMPECCABLE_PROVIDER_ID] || [];",
	].join("\n"),
	appliedSignature: "if (truthyEnv(process.env.IMPECCABLE_OMP_HOOK)) return 'stop';",
};

const CONCEPT_SEED_MAIN_GUARD: VendorFix = {
	id: "concept-seed-main-guard",
	targetRelative: "scripts/concept-seed.mjs",
	description: "Detect direct invocation of concept-seed.mjs through a symlinked skill dir.",
	anchor: "if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {",
	replacement: [
		"// Deployed installs reach this script through a symlinked skill directory, where",
		"// Node resolves import.meta.url to the real file but process.argv[1] keeps the",
		"// symlink path. Comparing canonical paths prevents a silent exit-0 no-op, the",
		"// same guard context.mjs and critique-storage.mjs already use.",
		"function invokedAsScript() {",
		"  const arg = process.argv[1];",
		"  if (!arg) return false;",
		"  try {",
		"    return realpathSync(arg) === realpathSync(fileURLToPath(import.meta.url));",
		"  } catch {",
		"    return resolve(arg) === fileURLToPath(import.meta.url);",
		"  }",
		"}",
		"",
		"if (invokedAsScript()) {",
	].join("\n"),
	appliedSignature: "function invokedAsScript() {",
};

/**
 * Fixes re-applied to the vendored skill after every re-vendor, in declaration
 * order (later fixes see the file as left by earlier ones). Drop an entry the
 * moment upstream fixes the same thing: `bun run update-impeccable` reports
 * `skip-already-applied` or `skip-anchor-missing` when that happens, and
 * `tests/impeccable-update.test.ts` asserts the vendored tree still carries
 * every fix so a re-vendor cannot quietly drop one.
 */
export const IMPECCABLE_VENDOR_FIXES: readonly VendorFix[] = [
	IMPECCABLE_OMP_HOOK_DETECTION,
	CONCEPT_SEED_FS_IMPORT,
	CONCEPT_SEED_MAIN_GUARD,
];

/** Re-apply {@link IMPECCABLE_VENDOR_FIXES} to a vendored skill directory. */
export async function applyVendorFixes(
	skillDir: string,
	fixes: readonly VendorFix[] = IMPECCABLE_VENDOR_FIXES,
): Promise<VendorFixOutcome[]> {
	const outcomes: VendorFixOutcome[] = [];
	for (const fix of fixes) {
		const filePath = join(skillDir, fix.targetRelative);
		let current: string;
		try {
			current = await readFile(filePath, "utf8");
		} catch {
			outcomes.push({ id: fix.id, kind: "skip-target-missing" });
			continue;
		}
		const plan = planPatch(fix, current);
		if (plan.kind === "error-anchor-ambiguous") {
			throw new Error(
				`Vendor fix ${fix.id} matched its anchor ${plan.matchCount} times in ${fix.targetRelative}; refusing to guess.`,
			);
		}
		if (plan.kind === "apply") await writeFile(filePath, plan.nextContent);
		outcomes.push({ id: fix.id, kind: plan.kind });
	}
	return outcomes;
}

interface ImpeccableDocRewrite {
	from: string;
	to: string;
	why: string;
}

const DETECT_COMMAND = `node ${DEPLOYED_SCRIPT_PATH}/scripts/detect.mjs`;
const HOOK_ADMIN_COMMAND = `node ${DEPLOYED_SCRIPT_PATH}/scripts/hook-admin.mjs`;

const IMPECCABLE_DOC_REWRITES: readonly ImpeccableDocRewrite[] = [
	{
		from: PI_SCRIPT_PATH,
		to: DEPLOYED_SCRIPT_PATH,
		why: "The vendored skill is deployed globally, not relative to a project cwd.",
	},
	{
		from: "  - Bash(npx impeccable *)",
		to: "",
		why: "The following Pi-native node allowance already covers the managed scripts.",
	},
	{
		from: "npx impeccable detect",
		to: DETECT_COMMAND,
		why: "The detector is already vendored and must run from the managed deployment.",
	},
	{
		from: "Use `npx impeccable ignores ...` for direct CLI CRUD on the same detector ignores.",
		to: `Use \`${HOOK_ADMIN_COMMAND}\` with the \`ignore-rule\`, \`ignore-file\`, or \`ignore-value\` action for direct CLI CRUD on the same detector ignores.`,
		why: "hook-admin.mjs exposes the real ignore CRUD actions; there is no `ignores` action.",
	},
	{
		from:
			"- **Tool version.** The installed skill is older than the published one. `context.mjs` reports that at boot as `UPDATE_AVAILABLE` and `npx impeccable update` fixes it. Not this command's job.",
		to: "- **Tool version.** The installed skill is older than the published one. `context.mjs` reports that at boot as `UPDATE_AVAILABLE`. To update this managed copy, run `(cd ~/Projects/omp-agent-setup && bun run update-impeccable && bun run bootstrap)`; this command does not update it.",
		why: "Managed Impeccable updates must come through this repository and then bootstrap the deployment.",
	},
];

/**
 * Rewrite vendored Impeccable documentation for the globally managed install.
 * The table keeps the path and command migrations declarative and makes each
 * rewrite idempotent, so re-vending an already rewritten tree is harmless.
 */
export function rewriteImpeccableScriptPaths(text: string): string {
	return IMPECCABLE_DOC_REWRITES.reduce(
		(current, rule) => current.replaceAll(rule.from, rule.to),
		text,
	);
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

const FORBIDDEN_PI_VARIANT_MARKERS = [
	"npx impeccable",
	".pi/skills/impeccable",
	".github/skills/impeccable",
	".claude/skills/impeccable",
	".cursor/skills/impeccable",
] as const;

/**
 * Reject a vendored tree from another harness before it can be deployed.
 * Provider source is checked directly, while path markers are restricted to
 * Markdown because hook-admin.mjs intentionally carries every provider's
 * manifest paths.
 */
export async function assertPiImpeccableVariant(skillDir: string): Promise<void> {
	const providerRelative = "scripts/lib/provider.mjs";
	const providerPath = join(skillDir, providerRelative);
	let providerText: string;
	try {
		providerText = await readFile(providerPath, "utf8");
	} catch {
		throw new Error(
			`Vendored Impeccable variant assertion failed for ${providerRelative}: file is missing; expected IMPECCABLE_PROVIDER_ID = "pi".`,
		);
	}
	const providerMatch = /IMPECCABLE_PROVIDER_ID\s*=\s*["']([^"']+)["']/.exec(providerText);
	if (providerMatch?.[1] !== "pi") {
		const found = providerMatch ? JSON.stringify(providerMatch[1]) : "no declaration";
		throw new Error(
			`Vendored Impeccable variant assertion failed for ${providerRelative}: found IMPECCABLE_PROVIDER_ID = ${found}; expected "pi".`,
		);
	}

	const entries = await readdir(skillDir, { recursive: true, withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		const filePath = join(entry.parentPath, entry.name);
		const content = await readFile(filePath, "utf8");
		const marker = FORBIDDEN_PI_VARIANT_MARKERS.find(candidate => content.includes(candidate));
		if (marker) {
			const relativePath = filePath.slice(skillDir.length + 1);
			throw new Error(
				`Vendored Impeccable variant assertion failed for ${relativePath}: found forbidden ${JSON.stringify(marker)}.`,
			);
		}
	}
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
