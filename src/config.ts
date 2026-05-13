import { type Document, parseDocument } from "yaml";

/**
 * The top-level OMP config keys this repository owns. Anything else in the
 * user's `~/.omp/agent/config.yml` is preserved verbatim across merges.
 */
export const MANAGED_KEYS = [
	"extensions",
	"skills",
	"ask",
	"compaction",
	"contextPromotion",
	"memory",
] as const;

export type ManagedKey = (typeof MANAGED_KEYS)[number];

/**
 * The managed values applied by `bun run bootstrap`. Anything not listed here
 * is left to the user. Keep this object the single source of truth; both the
 * merge logic and tests import it directly.
 */
export const MANAGED_CONFIG: Record<ManagedKey, unknown> = {
	extensions: [
		"~/Projects/plannotator/apps/pi-extension",
		"~/.omp/agent/extensions/superpowers-bootstrap.ts",
	],
	skills: {
		customDirectories: [
			"~/Projects/superpowers/skills",
			"~/Projects/plannotator/apps/pi-extension/skills",
		],
	},
	ask: {
		timeout: 0,
	},
	compaction: {
		strategy: "handoff",
		thresholdPercent: 80,
		thresholdTokens: -1,
		handoffSaveToDisk: true,
		idleEnabled: false,
		idleThresholdTokens: 100000,
		idleTimeoutSeconds: 1800,
		enabled: true,
	},
	contextPromotion: {
		enabled: false,
	},
	memory: {
		backend: "off",
	},
};

/**
 * Merge the managed keys into the user's YAML document, preserving unrelated
 * keys, ordering, and basic structure. Returns the resulting YAML text.
 *
 * Behavior contract:
 * - Existing managed keys are overwritten in place so their order in the file
 *   does not change unnecessarily.
 * - Missing managed keys are appended in declaration order at the end of the
 *   top-level mapping.
 * - Non-managed keys (`modelRoles`, `steeringMode`, `edit`, etc.) are never
 *   modified or reordered.
 * - Applying the merge twice in a row to its own output is a no-op for the
 *   managed keys (idempotent).
 *
 * Comment preservation: the `yaml` package preserves comments associated with
 * untouched nodes but may drop or relocate comments inside fully replaced
 * mappings. Today the managed config has no user comments inside the managed
 * sections; if that changes, revisit this module.
 */
export function mergeManagedConfig(
	existingYaml: string,
	managed: Record<string, unknown> = MANAGED_CONFIG,
): string {
	const doc: Document.Parsed = parseDocument(existingYaml);
	if (doc.contents === null || doc.contents === undefined) {
		doc.contents = doc.createNode({}) as Document.Parsed["contents"];
	}
	for (const key of Object.keys(managed)) {
		doc.set(key, managed[key]);
	}
	return doc.toString();
}

/**
 * Extract a top-level value as a plain JS object, useful for inspecting the
 * result of `mergeManagedConfig` in tests without re-parsing YAML manually.
 */
export function readTopLevel(yaml: string, key: string): unknown {
	const doc = parseDocument(yaml);
	const value = doc.get(key);
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value === "object" && value !== null && "toJSON" in value) {
		return (value as { toJSON: () => unknown }).toJSON();
	}
	return value;
}
