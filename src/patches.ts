/**
 * Pure planner for source patches applied against the globally installed
 * `@oh-my-pi` packages. Each {@link Patch} names its target
 * {@link Patch.package} so siblings under `node_modules/@oh-my-pi/`
 * (`pi-coding-agent`, `pi-agent-core`, `pi-ai`, …) are addressed explicitly instead of via
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
type PatchPackage = "pi-coding-agent" | "pi-agent-core" | "pi-ai";

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
 * Drop malformed custom/hookMessage entries inside the shared
 * `convertMessageToLlm` transformer instead of forwarding a `content:
 * undefined` payload to provider transports.
 *
 * Without this guard, subagent dispatch under `openai-codex-responses`
 * instantly fails with `undefined is not an object (evaluating
 * 'content.filter')` because a `CustomMessage` with `content: undefined`
 * reaches the provider's `partitionVisionContent`, which calls `.filter` on
 * it.
 */
export const CONVERT_TO_LLM_CONTENT_GUARD: Patch = {
	id: "convert-to-llm-content-guard",
	package: "pi-agent-core",
	targetRelative: "src/compaction/messages.ts",
	description: "Drop malformed custom/hookMessage entries in convertMessageToLlm.",
	anchor: [
		'\t\t\tcase "custom":',
		'\t\t\tcase "hookMessage": {',
		"\t\t\t\tconst content =",
		'\t\t\t\t\ttypeof message.content === "string"',
		'\t\t\t\t\t\t? [{ type: "text" as const, text: message.content }]',
		"\t\t\t\t\t\t: message.content;",
		"\t\t\t\treturn {",
		'\t\t\t\t\trole: "developer",',
		"\t\t\t\t\tcontent,",
		"\t\t\t\t\tattribution: message.attribution,",
		"\t\t\t\t\ttimestamp: message.timestamp,",
		"\t\t\t\t};",
		"\t\t\t}",
	].join("\n"),
	replacement: [
		'\t\t\tcase "custom":',
		'\t\t\tcase "hookMessage": {',
		"\t\t\t\t// CustomMessage.content is typed as string | content[], but extensions/hooks calling",
		"\t\t\t\t// pi.sendMessage() can violate the contract at runtime (e.g. pi.sendMessage(stringArg)",
		"\t\t\t\t// instead of pi.sendMessage({ customType, content, ... })). Drop messages without",
		"\t\t\t\t// meaningful content rather than forwarding a malformed payload to providers, which",
		'\t\t\t\t// otherwise crash deep in transport code with errors like "content.map is not a function".',
		"\t\t\t\tconst raw = message.content;",
		"\t\t\t\tlet content: (TextContent | ImageContent)[];",
		'\t\t\t\tif (typeof raw === "string") {',
		"\t\t\t\t\tif (raw.length === 0) return undefined;",
		'\t\t\t\t\tcontent = [{ type: "text", text: raw }];',
		"\t\t\t\t} else if (Array.isArray(raw) && raw.length > 0) {",
		"\t\t\t\t\tcontent = raw;",
		"\t\t\t\t} else {",
		"\t\t\t\t\treturn undefined;",
		"\t\t\t\t}",
		"\t\t\t\treturn {",
		'\t\t\t\t\trole: "developer",',
		"\t\t\t\t\tcontent,",
		"\t\t\t\t\tattribution: message.attribution,",
		"\t\t\t\t\ttimestamp: message.timestamp,",
		"\t\t\t\t};",
		"\t\t\t}",
	].join("\n"),
	appliedSignature:
		"// CustomMessage.content is typed as string | content[], but extensions/hooks calling",
};

/**
 * Refuse malformed custom-message session entries at the persistence boundary.
 *
 * Extension APIs are typed, but runtime callers can still pass missing
 * `customType`/`content`. Persisting that shape creates `custom_message` JSONL
 * entries with no content, which later crash provider conversion and tree
 * rendering. Returning an empty id matches "nothing appended" without changing
 * the public method signature.
 */
const CUSTOM_MESSAGE_ENTRY_CONTENT_GUARD: Patch = {
	id: "custom-message-entry-content-guard",
	package: "pi-coding-agent",
	targetRelative: "src/session/session-manager.ts",
	description: "Skip malformed custom_message entries before they reach session history.",
	anchor: [
		"\tappendCustomMessageEntry<T = unknown>(",
		"\t\tcustomType: string,",
		"\t\tcontent: string | (TextContent | ImageContent)[],",
		"\t\tdisplay: boolean,",
		"\t\tdetails?: T,",
		'\t\tattribution: MessageAttribution = "agent",',
		"\t): string {",
		"\t\tconst entry: CustomMessageEntry<T> = {",
		'\t\t\ttype: "custom_message",',
		"\t\t\tcustomType,",
		"\t\t\tcontent,",
	].join("\n"),
	replacement: [
		"\tappendCustomMessageEntry<T = unknown>(",
		"\t\tcustomType: string,",
		"\t\tcontent: string | (TextContent | ImageContent)[],",
		"\t\tdisplay: boolean,",
		"\t\tdetails?: T,",
		'\t\tattribution: MessageAttribution = "agent",',
		"\t): string {",
		'\t\tif (typeof customType !== "string" || customType.length === 0) return "";',
		'\t\tif (typeof content === "string") {',
		'\t\t\tif (content.length === 0) return "";',
		"\t\t} else if (!Array.isArray(content) || content.length === 0) {",
		'\t\t\treturn "";',
		"\t\t}",
		"\t\tconst entry: CustomMessageEntry<T> = {",
		'\t\t\ttype: "custom_message",',
		"\t\t\tcustomType,",
		"\t\t\tcontent,",
	].join("\n"),
	appliedSignature: 'typeof customType !== "string" || customType.length === 0',
};

/**
 * Same persistence guard as {@link CUSTOM_MESSAGE_ENTRY_CONTENT_GUARD}, but
 * against the bundled CLI entrypoint that `~/.bun/bin/omp` executes.
 */
const BUNDLED_CUSTOM_MESSAGE_ENTRY_CONTENT_GUARD: Patch = {
	id: "bundled-custom-message-entry-content-guard",
	package: "pi-coding-agent",
	targetRelative: "dist/cli.js",
	description: "Skip malformed bundled custom_message entries before they reach session history.",
	anchor:
		'appendCustomMessageEntry(customType,content,display,details,attribution="agent"){let entry={type:"custom_message",customType,content,display,details:stripInternalDetailsFields(details),attribution,id:generateId(this.#byId),parentId:this.#leafId,timestamp:new Date().toISOString()};return this.#appendEntry(entry),entry.id}',
	replacement:
		'appendCustomMessageEntry(customType,content,display,details,attribution="agent"){if(typeof customType!=="string"||customType.length===0)return"";if(typeof content==="string"){if(content.length===0)return""}else if(!Array.isArray(content)||content.length===0)return"";let entry={type:"custom_message",customType,content,display,details:stripInternalDetailsFields(details),attribution,id:generateId(this.#byId),parentId:this.#leafId,timestamp:new Date().toISOString()};return this.#appendEntry(entry),entry.id}',
	appliedSignature: 'typeof customType!=="string"||customType.length===0',
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
 * Same runtime guard as {@link CONVERT_TO_LLM_CONTENT_GUARD}, but against the
 * bundled CLI entrypoint that `~/.bun/bin/omp` executes in current OMP builds.
 */
const BUNDLED_CONVERT_TO_LLM_CONTENT_GUARD: Patch = {
	id: "bundled-convert-to-llm-content-guard",
	package: "pi-coding-agent",
	targetRelative: "dist/cli.js",
	description: "Drop malformed custom/hookMessage entries in the bundled CLI converter.",
	anchor:
		'case"custom":case"hookMessage":return{role:"developer",content:typeof message2.content==="string"?[{type:"text",text:message2.content}]:message2.content,attribution:message2.attribution,timestamp:message2.timestamp};',
	replacement:
		'case"custom":case"hookMessage":{let raw=message2.content;if(typeof raw==="string"){if(raw.length===0)return;let content=[{type:"text",text:raw}];return{role:"developer",content,attribution:message2.attribution,timestamp:message2.timestamp}}if(!Array.isArray(raw)||raw.length===0)return;return{role:"developer",content:raw,attribution:message2.attribution,timestamp:message2.timestamp}}',
	appliedSignature: "!Array.isArray(raw)||raw.length===0",
};

/**
 * Same runtime guard as {@link TREE_SELECTOR_CUSTOM_MESSAGE_GUARD}, but against
 * the bundled CLI entrypoint that owns the interactive TUI renderer.
 */
const BUNDLED_TREE_SELECTOR_CUSTOM_MESSAGE_GUARD: Patch = {
	id: "bundled-tree-selector-custom-message-guard",
	package: "pi-coding-agent",
	targetRelative: "dist/cli.js",
	description:
		"Render bundled tree-selector custom_message entries without crashing when `content` is missing.",
	anchor:
		'let content=typeof entry.content==="string"?entry.content:entry.content.filter((c2)=>c2.type==="text").map((c2)=>c2.text).join("");',
	replacement:
		'let content=typeof entry.content==="string"?entry.content:(entry.content??[]).filter((c2)=>c2.type==="text").map((c2)=>c2.text).join("");',
	appliedSignature: "(entry.content??[])",
};

/**
 * Ordered list of patches the bootstrap step applies, in declaration order.
 * Order matters: later patches see the file as left by earlier patches.
 */
export const OMP_PATCHES: readonly Patch[] = [
	CONVERT_TO_LLM_CONTENT_GUARD,
	CUSTOM_MESSAGE_ENTRY_CONTENT_GUARD,
	BUNDLED_CONVERT_TO_LLM_CONTENT_GUARD,
	BUNDLED_CUSTOM_MESSAGE_ENTRY_CONTENT_GUARD,
	TREE_SELECTOR_CUSTOM_MESSAGE_GUARD,
	BUNDLED_TREE_SELECTOR_CUSTOM_MESSAGE_GUARD,
];
