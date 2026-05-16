import {
	applyEdits,
	findNodeAtLocation,
	getNodeValue,
	modify,
	type ParseError,
	parseTree,
	printParseErrorCode,
} from "jsonc-parser";

/**
 * Top-level Zed settings keys this repository owns. Everything else in the
 * user's `~/.config/zed/settings.json` — including `languages.CSharp`,
 * `theme`, `vim_mode`, panel placements — is preserved verbatim across merges.
 */
export const MANAGED_ZED_KEYS = ["agent_servers"] as const;

export type ManagedZedKey = (typeof MANAGED_ZED_KEYS)[number];

export interface ZedManagedContext {
	/** Absolute path to the `omp` binary (resolve at the boundary, never bake). */
	ompPath: string;
}

/**
 * Canonical managed values. `agent_servers["omp-acp"]` registers OMP as a
 * custom ACP server inside Zed (OMP is not in Zed's ACP Registry; the
 * registry's `pi` entry is upstream Pi, not OMP). `command` is an absolute
 * path because GUI-launched Zed cannot always be trusted to inherit the
 * shell's PATH on macOS.
 */
export function buildManagedZedSettings(
	ctx: ZedManagedContext,
): Record<ManagedZedKey, Record<string, unknown>> {
	return {
		agent_servers: {
			"omp-acp": {
				type: "custom",
				command: ctx.ompPath,
				args: ["acp"],
			},
		},
	};
}

export class ZedSettingsParseError extends Error {
	readonly parseErrors: readonly ParseError[];

	constructor(parseErrors: readonly ParseError[]) {
		const summary = parseErrors
			.slice(0, 3)
			.map(e => `${printParseErrorCode(e.error)} at offset ${e.offset}`)
			.join("; ");
		super(`Zed settings JSONC failed to parse: ${summary}`);
		this.name = "ZedSettingsParseError";
		this.parseErrors = parseErrors;
	}
}

const FORMATTING = { tabSize: 2, insertSpaces: true, eol: "\n" } as const;

/**
 * Merge managed Zed settings into existing JSONC text.
 *
 * Behavior contract:
 * - Throws `ZedSettingsParseError` on syntactically invalid JSONC.
 *   `jsonc-parser`'s `modify`/`parseTree` are fault-tolerant by design;
 *   we explicitly inspect the errors array and bail rather than rewrite
 *   a partially-parsed AST.
 * - Existing managed sub-keys are replaced in place with the canonical value.
 * - Missing managed sub-keys are added.
 * - Unmanaged keys (including unrelated entries inside `agent_servers`)
 *   and comments are preserved verbatim because edits are computed at
 *   character offsets, never via re-serialization.
 * - Applying the merge twice to its own output yields byte-equal text.
 * - Empty / whitespace-only input is seeded with `{}` first.
 */
export function mergeManagedZedSettings(
	existing: string,
	managed: Record<ManagedZedKey, Record<string, unknown>>,
): string {
	let text = existing.trim().length === 0 ? "{}\n" : existing;
	assertValidJsonc(text);
	for (const topKey of MANAGED_ZED_KEYS) {
		const desired = managed[topKey];
		for (const subKey of Object.keys(desired)) {
			const edits = modify(text, [topKey, subKey], desired[subKey], {
				formattingOptions: FORMATTING,
			});
			text = applyEdits(text, edits);
		}
	}
	return text;
}

/**
 * Read a single `agent_servers[name]` entry. Returns `undefined` if the
 * entry does not exist. Throws `ZedSettingsParseError` if the input is
 * not valid JSONC (so callers cannot mistake malformed user input for
 * "missing").
 */
export function readZedAgentServer(text: string, name: string): unknown {
	assertValidJsonc(text);
	const tree = parseTree(text);
	if (!tree) return undefined;
	const node = findNodeAtLocation(tree, ["agent_servers", name]);
	return node ? getNodeValue(node) : undefined;
}

function assertValidJsonc(text: string): void {
	const errors: ParseError[] = [];
	parseTree(text, errors);
	if (errors.length > 0) throw new ZedSettingsParseError(errors);
}
