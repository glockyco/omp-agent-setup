/**
 * Pure planner for source patches applied against the globally installed
 * `@oh-my-pi` packages. Each {@link Patch} names its target
 * {@link Patch.package} so siblings under `node_modules/@oh-my-pi/`
 * (`pi-coding-agent`, `pi-ai`, …) are addressed explicitly instead of via
 * relative path escapes.
 *
 * Why this module exists: OMP ships TypeScript sources verbatim (`bun run`
 * loads `src/*.ts` directly), and the package gets blown away on every
 * `omp update`. When we want a custom modification on top of OMP that
 * survives updates, we re-apply that modification idempotently at every
 * `bun run bootstrap`. That keeps `~/.omp/agent` self-healing without us
 * holding the diff in our heads.
 *
 * Each patch is a literal-block replacement:
 * - `anchor`: the exact OLD block (whitespace-sensitive). Must appear once.
 * - `replacement`: the exact NEW block we want in its place.
 * - `appliedSignature`: a substring that exists ONLY in `replacement`. Lets
 *   us detect "already patched" and short-circuit without re-writing.
 *
 * Drop a patch from {@link OMP_PATCHES} the moment we no longer want the
 * modification, or the surrounding code shape changes enough that the
 * anchor stops matching (the planner reports `skip-anchor-missing` in that
 * case so we notice).
 */

/**
 * Installed `@oh-my-pi` package a patch targets. The value is the directory
 * name under `node_modules/@oh-my-pi/`, so it doubles as the path segment used
 * to locate the target file at apply time.
 */
type PatchPackage = "pi-coding-agent" | "pi-ai";

/** Identity and content of a single source patch. */
export interface Patch {
	/** Stable id used in reports and tests; one patch per id. */
	id: string;
	/** Installed `@oh-my-pi` package the target file lives in. */
	package: PatchPackage;
	/** Path inside {@link Patch.package}, POSIX style. */
	targetRelative: string;
	/** One-line human-readable purpose. */
	description: string;
	/** Exact OLD block. Must occur exactly once in the unpatched file. */
	anchor: string;
	/** Exact NEW block to substitute in place of `anchor`. */
	replacement: string;
	/** Substring that exists only in `replacement`; used as idempotency probe. */
	appliedSignature: string;
}

/** Outcome of planning a single patch against the current file contents. */
export type PatchPlanEntry =
	| { kind: "apply"; patch: Patch; nextContent: string }
	| { kind: "skip-already-applied"; patch: Patch }
	| { kind: "skip-anchor-missing"; patch: Patch }
	| { kind: "error-anchor-ambiguous"; patch: Patch; matchCount: number };

/**
 * Decide what to do for a single patch given the current file contents.
 *
 * Order of checks is deliberate:
 * 1. Already-applied check first, so re-running bootstrap on a healthy install
 *    is a no-op (no file mtime churn, no spurious diff in backups).
 * 2. Anchor match second. Exactly one match: apply. Zero: anchor went away
 *    (something rewrote the surrounding code) — skip with a distinct status
 *    so the CLI can surface it. Multiple: refuse to guess which one to
 *    replace.
 */
export function planPatch(patch: Patch, currentContent: string): PatchPlanEntry {
	if (currentContent.includes(patch.appliedSignature)) {
		return { kind: "skip-already-applied", patch };
	}
	const matchCount = countOccurrences(currentContent, patch.anchor);
	if (matchCount === 0) {
		return { kind: "skip-anchor-missing", patch };
	}
	if (matchCount > 1) {
		return { kind: "error-anchor-ambiguous", patch, matchCount };
	}
	const nextContent = currentContent.replace(patch.anchor, patch.replacement);
	return { kind: "apply", patch, nextContent };
}

/**
 * Count non-overlapping occurrences of `needle` in `haystack`. Both
 * arguments are treated as plain strings (no regex semantics) so the
 * tab/newline-sensitive `anchor` field of a {@link Patch} survives.
 */
function countOccurrences(haystack: string, needle: string): number {
	if (needle.length === 0) return 0;
	let count = 0;
	let index = 0;
	while (true) {
		const found = haystack.indexOf(needle, index);
		if (found === -1) return count;
		count += 1;
		index = found + needle.length;
	}
}

/**
 * Drop malformed custom/hookMessage entries inside `convertToLlm` instead of
 * forwarding a `content: undefined` payload to provider transports.
 *
 * Without this guard, subagent dispatch under `openai-codex-responses`
 * instantly fails with `undefined is not an object (evaluating
 * 'content.filter')` because a `CustomMessage` with `content: undefined`
 * reaches the provider's `partitionVisionContent`, which calls `.filter` on
 * it.
 */
export const CONVERT_TO_LLM_CONTENT_GUARD: Patch = {
	id: "convert-to-llm-content-guard",
	package: "pi-coding-agent",
	targetRelative: "src/session/messages.ts",
	description: "Drop malformed custom/hookMessage entries in convertToLlm.",
	anchor: [
		'\t\t\t\tcase "custom":',
		'\t\t\t\tcase "hookMessage": {',
		'\t\t\t\t\tconst content = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content;',
		'\t\t\t\t\tconst role = "user";',
		"\t\t\t\t\tconst attribution = m.attribution;",
		"\t\t\t\t\treturn {",
		"\t\t\t\t\t\trole,",
		"\t\t\t\t\t\tcontent,",
		"\t\t\t\t\t\tattribution,",
		"\t\t\t\t\t\ttimestamp: m.timestamp,",
		"\t\t\t\t\t};",
		"\t\t\t\t}",
	].join("\n"),
	replacement: [
		'\t\t\t\tcase "custom":',
		'\t\t\t\tcase "hookMessage": {',
		"\t\t\t\t\t// CustomMessage.content is typed as string | content[], but extensions/hooks calling",
		"\t\t\t\t\t// pi.sendMessage() can violate the contract at runtime (e.g. pi.sendMessage(stringArg)",
		"\t\t\t\t\t// instead of pi.sendMessage({ customType, content, ... })). Drop messages without",
		"\t\t\t\t\t// meaningful content rather than forwarding a malformed payload to providers, which",
		'\t\t\t\t\t// otherwise crash deep in transport code with errors like "content.map is not a function".',
		"\t\t\t\t\tconst raw = m.content;",
		"\t\t\t\t\tlet content: (TextContent | ImageContent)[];",
		'\t\t\t\t\tif (typeof raw === "string") {',
		"\t\t\t\t\t\tif (raw.length === 0) return undefined;",
		'\t\t\t\t\t\tcontent = [{ type: "text", text: raw }];',
		"\t\t\t\t\t} else if (Array.isArray(raw) && raw.length > 0) {",
		"\t\t\t\t\t\tcontent = raw;",
		"\t\t\t\t\t} else {",
		"\t\t\t\t\t\treturn undefined;",
		"\t\t\t\t\t}",
		"\t\t\t\t\treturn {",
		'\t\t\t\t\t\trole: "user",',
		"\t\t\t\t\t\tcontent,",
		"\t\t\t\t\t\tattribution: m.attribution,",
		"\t\t\t\t\t\ttimestamp: m.timestamp,",
		"\t\t\t\t\t};",
		"\t\t\t\t}",
	].join("\n"),
	appliedSignature:
		"// CustomMessage.content is typed as string | content[], but extensions/hooks calling",
};

/**
 * Tolerate a `custom_message` session entry whose `content` field is missing
 * when rendering the tree-selector overlay (`/tree`, history scrubbing).
 *
 * Without this guard, scrolling onto a malformed `custom_message` entry
 * crashes the TUI with `undefined is not an object (evaluating
 * 'entry.content.filter')` because the renderer's ternary only handles
 * `string` and assumes the array branch is always defined.
 */
export const TREE_SELECTOR_CUSTOM_MESSAGE_GUARD: Patch = {
	id: "tree-selector-custom-message-guard",
	package: "pi-coding-agent",
	targetRelative: "src/modes/components/tree-selector.ts",
	description: "Render custom_message entries without crashing when `content` is missing.",
	anchor: [
		"\t\t\t\tconst content =",
		'\t\t\t\t\ttypeof entry.content === "string"',
		"\t\t\t\t\t\t? entry.content",
		"\t\t\t\t\t\t: entry.content",
		'\t\t\t\t\t\t\t\t.filter((c): c is { type: "text"; text: string } => c.type === "text")',
		"\t\t\t\t\t\t\t\t.map(c => c.text)",
		'\t\t\t\t\t\t\t\t.join("");',
	].join("\n"),
	replacement: [
		"\t\t\t\tconst content =",
		'\t\t\t\t\ttypeof entry.content === "string"',
		"\t\t\t\t\t\t? entry.content",
		"\t\t\t\t\t\t: (entry.content ?? [])",
		'\t\t\t\t\t\t\t\t.filter((c): c is { type: "text"; text: string } => c.type === "text")',
		"\t\t\t\t\t\t\t\t.map(c => c.text)",
		'\t\t\t\t\t\t\t\t.join("");',
	].join("\n"),
	appliedSignature: ": (entry.content ?? [])",
};

/**
 * Strip the unentitled `context-1m-2025-08-07` (1M long-context) beta from
 * Anthropic web-search requests.
 *
 * OMP 15.8.0 routed `web_search`'s Anthropic provider through the same header
 * builder as streaming chat, which unconditionally adds the agent-default
 * `context-1m-2025-08-07` beta. The web-search body is a one-line query sent to
 * `/v1/messages?beta=true`, where Anthropic strictly validates beta
 * entitlement and returns `400 ... The long context beta is not yet available
 * for this subscription` for OAuth tiers without 1M access — breaking every web
 * search. We post-filter the header instead of rebuilding the beta set, so the
 * fix survives upstream changes to the agent beta defaults.
 */
export const WEB_SEARCH_DROP_CONTEXT_1M_BETA: Patch = {
	id: "web-search-drop-context-1m-beta",
	package: "pi-ai",
	targetRelative: "src/utils/anthropic-auth.ts",
	description: "Drop the unentitled context-1m beta from Anthropic web-search requests.",
	anchor: [
		"export function buildAnthropicSearchHeaders(auth: AnthropicAuthConfig): Record<string, string> {",
		"\treturn buildProviderAnthropicHeaders({",
		"\t\tapiKey: auth.apiKey,",
		"\t\tbaseUrl: auth.baseUrl,",
		"\t\tisOAuth: auth.isOAuth,",
		'\t\textraBetas: ["web-search-2025-03-05"],',
		"\t\tstream: false,",
		"\t\tmodelHeaders: resolveAnthropicCustomHeadersForBaseUrl(auth.baseUrl),",
		"\t});",
		"}",
	].join("\n"),
	replacement: [
		"export function buildAnthropicSearchHeaders(auth: AnthropicAuthConfig): Record<string, string> {",
		"\tconst headers = buildProviderAnthropicHeaders({",
		"\t\tapiKey: auth.apiKey,",
		"\t\tbaseUrl: auth.baseUrl,",
		"\t\tisOAuth: auth.isOAuth,",
		'\t\textraBetas: ["web-search-2025-03-05"],',
		"\t\tstream: false,",
		"\t\tmodelHeaders: resolveAnthropicCustomHeadersForBaseUrl(auth.baseUrl),",
		"\t});",
		"\t// OMP patch: a one-line web-search query never needs 1M context, but the",
		"\t// shared builder injects the agent-default `context-1m-2025-08-07` beta.",
		"\t// On `/v1/messages?beta=true` that beta is rejected for OAuth tiers without",
		'\t// 1M entitlement ("The long context beta is not yet available for this',
		'\t// subscription"), which breaks web search. Strip just that beta.',
		"\tfor (const [key, value] of Object.entries(headers)) {",
		'\t\tif (key.toLowerCase() !== "anthropic-beta") continue;',
		"\t\tconst betas = value",
		'\t\t\t.split(",")',
		"\t\t\t.map(beta => beta.trim())",
		'\t\t\t.filter(beta => beta.length > 0 && beta !== "context-1m-2025-08-07");',
		'\t\tif (betas.length > 0) headers[key] = betas.join(",");',
		"\t\telse delete headers[key];",
		"\t}",
		"\treturn headers;",
		"}",
	].join("\n"),
	appliedSignature: 'beta !== "context-1m-2025-08-07"',
};

/**
 * Ordered list of patches the bootstrap step applies, in declaration order.
 * Order matters: later patches see the file as left by earlier patches.
 */
export const OMP_PATCHES: readonly Patch[] = [
	CONVERT_TO_LLM_CONTENT_GUARD,
	TREE_SELECTOR_CUSTOM_MESSAGE_GUARD,
	WEB_SEARCH_DROP_CONTEXT_1M_BETA,
];
