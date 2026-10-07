import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** The marketplace, plugin and payload identity that every host installs. */
export const MARKETPLACE = "glockyco";
export const PLUGIN = "personal";
export const PAYLOAD = "plugin";
export const CATALOG = join(".omp-plugin", "marketplace.json");

export const EXTENSIONS = ["./extensions/personal-commit.ts", "./extensions/plannotator.ts"];
export const SKILLS = [
	"commit-policy",
	"openspec-apply-change",
	"openspec-archive-change",
	"openspec-explore",
	"openspec-propose",
	"openspec-sync-specs",
	"openspec-update-change",
	"research-evidence",
	"research-paper-writing",
];
export const COMMANDS = [
	"opsx-apply",
	"opsx-archive",
	"opsx-explore",
	"opsx-propose",
	"opsx-sync",
	"opsx-update",
];
/** Support files that a skill reads at run time; losing one breaks the skill, not discovery. */
export const SKILL_ASSETS = [
	"skills/research-evidence/scripts/fetch_pdf.py",
	"skills/research-paper-writing/LICENSE",
	"skills/research-paper-writing/references/introduction.md",
	"skills/research-paper-writing/references/examples/index.md",
];
export const RULE = "rules/personal-policy.md";
export const LSP_CONFIG = "./lsp/lsp.json";
/** Entries that belong to development, never to the installed payload. */
const DEVELOPMENT_ENTRIES: Record<string, true> = {
	tests: true,
	node_modules: true,
	__pycache__: true,
	".DS_Store": true,
	coverage: true,
};

export interface CatalogEntry {
	name: string;
	source: string;
	version: string;
	lspServers?: unknown;
	[key: string]: unknown;
}

export interface Catalog {
	name: string;
	owner?: { name?: string };
	plugins: CatalogEntry[];
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** Orders two `x.y.z` versions; anything else is rejected rather than guessed. */
export function compareVersions(left: string, right: string): number {
	const a = SEMVER.exec(left);
	const b = SEMVER.exec(right);
	if (!a || !b) throw new Error(`not an x.y.z release version: ${a ? right : left}`);
	for (let index = 1; index <= 3; index++) {
		const difference = Number(a[index]) - Number(b[index]);
		if (difference !== 0) return Math.sign(difference);
	}
	return 0;
}

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

function reason(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Returns the personal catalog entry, or throws with the reason it is unusable. */
export function personalEntry(catalog: Catalog): CatalogEntry {
	const entries = catalog.plugins.filter(plugin => plugin.name === PLUGIN);
	if (entries.length !== 1) throw new Error(`catalog must list exactly one "${PLUGIN}" plugin`);
	return entries[0] as CatalogEntry;
}

function walk(root: string, relative = ""): string[] {
	const found: string[] = [];
	for (const name of readdirSync(join(root, relative))) {
		const child = relative ? `${relative}/${name}` : name;
		found.push(child);
		if (statSync(join(root, child)).isDirectory()) found.push(...walk(root, child));
	}
	return found;
}

/**
 * Validates a candidate release tree: the catalog, the payload manifest, the
 * declared capabilities and the development boundary. Each finding names the
 * lost capability or file, so a failure says what users would lose.
 */
export function validateReleaseTree(root: string): string[] {
	const findings: string[] = [];
	let catalog: Catalog;
	try {
		catalog = readJson(join(root, CATALOG)) as Catalog;
	} catch (error) {
		return [`catalog ${CATALOG} is unreadable: ${reason(error)}`];
	}
	if (catalog.name !== MARKETPLACE) findings.push(`catalog name must be "${MARKETPLACE}"`);
	if (!catalog.owner?.name) findings.push("catalog owner.name is required");
	if (!Array.isArray(catalog.plugins)) return [...findings, "catalog plugins must be an array"];
	let entry: CatalogEntry;
	try {
		entry = personalEntry(catalog);
	} catch (error) {
		return [...findings, reason(error)];
	}
	if (entry.source !== `./${PAYLOAD}`) findings.push(`plugin source must be "./${PAYLOAD}"`);
	if (!SEMVER.test(String(entry.version))) findings.push("plugin version must be x.y.z");
	if (entry.lspServers !== LSP_CONFIG) {
		findings.push(`plugin lspServers must deliver ${LSP_CONFIG} (LSP overrides would be lost)`);
	}

	const payload = join(root, PAYLOAD);
	let manifest: { version?: string; omp?: { extensions?: string[] } };
	try {
		manifest = readJson(join(payload, "package.json")) as typeof manifest;
	} catch (error) {
		return [...findings, `payload manifest is unreadable: ${reason(error)}`];
	}
	if (manifest.version !== entry.version) {
		findings.push(
			`payload version ${manifest.version} differs from catalog version ${entry.version}`,
		);
	}
	const extensions = manifest.omp?.extensions ?? [];
	for (const extension of EXTENSIONS) {
		if (!extensions.includes(extension)) findings.push(`extension entry missing: ${extension}`);
		if (!existsSync(join(payload, extension)))
			findings.push(`extension module missing: ${extension}`);
	}
	for (const skill of SKILLS) {
		if (!existsSync(join(payload, "skills", skill, "SKILL.md")))
			findings.push(`skill missing: ${skill}`);
	}
	for (const command of COMMANDS) {
		if (!existsSync(join(payload, "commands", `${command}.md`))) {
			findings.push(`command missing: ${command}`);
		}
	}
	for (const asset of SKILL_ASSETS) {
		if (!existsSync(join(payload, asset))) findings.push(`skill asset missing: ${asset}`);
	}
	const helper = join(payload, SKILL_ASSETS[0] as string);
	if (existsSync(helper) && (statSync(helper).mode & 0o111) === 0) {
		findings.push(`skill asset is not executable: ${SKILL_ASSETS[0]}`);
	}
	if (!existsSync(join(payload, RULE))) findings.push(`rule missing: ${RULE}`);
	try {
		const lsp = readJson(join(payload, LSP_CONFIG)) as { servers?: Record<string, unknown> };
		if (!lsp.servers || typeof lsp.servers !== "object") findings.push("LSP config has no servers");
	} catch (error) {
		findings.push(`LSP config is unreadable: ${reason(error)}`);
	}
	for (const path of walk(payload)) {
		const name = path.split("/").at(-1) as string;
		if (DEVELOPMENT_ENTRIES[name] || name.endsWith(".test.ts") || name.startsWith("test_")) {
			findings.push(`development file inside the payload: ${PAYLOAD}/${path}`);
		}
	}
	return findings;
}
