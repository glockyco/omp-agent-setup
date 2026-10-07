import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	CATALOG,
	type Catalog,
	type CatalogEntry,
	compareVersions,
	PAYLOAD,
	personalEntry,
	validateReleaseTree,
} from "./release.ts";

/** Catalog entry fields that describe the listing, not what gets installed. */
const LISTING_FIELDS: Record<string, true> = {
	description: true,
	repository: true,
	homepage: true,
	license: true,
	author: true,
	keywords: true,
	category: true,
	tags: true,
	version: true,
};

function git(root: string, ...args: string[]): { ok: boolean; output: string } {
	const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
	return { ok: result.status === 0, output: result.status === 0 ? result.stdout : result.stderr };
}

function deliveryFields(entry: CatalogEntry | undefined): string {
	if (!entry) return "absent";
	const kept = Object.entries(entry).filter(([key]) => !LISTING_FIELDS[key]);
	return JSON.stringify(kept.sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Compares the working tree with the merge base of `base`. A changed runtime
 * payload or catalog delivery field needs a newer release version: the plugin
 * manager only offers an upgrade for a newer catalog version, and a targeted
 * reinstall of an unchanged version would silently replace published content.
 */
export function checkReleaseVersion(root: string, base: string): { ok: boolean; message: string } {
	const findings = validateReleaseTree(root);
	if (findings.length > 0) return { ok: false, message: findings.join("\n") };

	const mergeBase = git(root, "merge-base", base, "HEAD");
	if (!mergeBase.ok) {
		return { ok: false, message: `cannot resolve release base ${base}: ${mergeBase.output.trim()}` };
	}
	const baseRevision = mergeBase.output.trim();
	const current = personalEntry(JSON.parse(readFileSync(join(root, CATALOG), "utf8")) as Catalog);

	const baseCatalog = git(root, "show", `${baseRevision}:${CATALOG}`);
	const baseEntry = baseCatalog.ok
		? personalEntry(JSON.parse(baseCatalog.output) as Catalog)
		: undefined;
	const baseManifest = git(root, "show", `${baseRevision}:${PAYLOAD}/package.json`);
	const manifest: unknown = baseManifest.ok ? JSON.parse(baseManifest.output) : undefined;
	const manifestVersion =
		manifest &&
		typeof manifest === "object" &&
		"version" in manifest &&
		typeof manifest.version === "string"
			? manifest.version
			: undefined;
	const baseVersion = baseEntry?.version ?? manifestVersion;
	const changed = [
		...git(root, "diff", "--name-only", baseRevision, "--", PAYLOAD).output.split("\n"),
		...git(root, "ls-files", "--others", "--exclude-standard", "--", PAYLOAD).output.split("\n"),
	].filter(path => path.length > 0);
	const deliveryChanged = deliveryFields(baseEntry) !== deliveryFields(current);
	if (changed.length === 0 && !deliveryChanged) {
		return { ok: true, message: `runtime unchanged since ${baseRevision.slice(0, 12)}` };
	}

	const reason =
		changed.length > 0 ? `${changed.length} payload file(s)` : "catalog delivery fields";
	if (baseVersion !== undefined && compareVersions(current.version, baseVersion) <= 0) {
		return {
			ok: false,
			message: `${reason} changed since ${baseRevision.slice(0, 12)} but the release version stays ${current.version} (base ${baseVersion}); raise it in ${CATALOG} and ${PAYLOAD}/package.json`,
		};
	}
	return {
		ok: true,
		message: `${reason} changed; release ${baseVersion ?? "none"} -> ${current.version}`,
	};
}

if (import.meta.main) {
	const base = process.env.RELEASE_BASE ?? "origin/main";
	const result = checkReleaseVersion(process.cwd(), base);
	(result.ok ? console.log : console.error)(result.message);
	process.exit(result.ok ? 0 : 1);
}
