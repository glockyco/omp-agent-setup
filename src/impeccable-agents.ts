// Pure translation from Impeccable's Claude-variant agent front-matter into
// OMP's task-agent schema. Upstream ships agent definitions only in the
// `.claude` variant, so `impeccable-update.ts` vendors them through here. The
// body copies verbatim; only the front-matter is rewritten.

/**
 * Claude tool names to OMP's. An unrecognised name is a hard error rather than
 * a silent drop, so an upstream addition surfaces at vendor time instead of as
 * a subagent that quietly cannot do its job.
 */
export const CLAUDE_TOOL_NAMES: Readonly<Record<string, string>> = {
	Read: "read",
	Write: "write",
	Edit: "edit",
	Bash: "bash",
	Glob: "glob",
	Grep: "grep",
};

/**
 * OMP's `ThinkingLevel` vocabulary (`@oh-my-pi/pi-agent-core/src/thinking.ts`)
 * plus the `auto` sentinel that `parseConfiguredThinkingLevel` accepts.
 */
export const OMP_THINKING_LEVELS: readonly string[] = [
	"inherit",
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
	"auto",
];

/**
 * OMP appends `yield` to any agent that declares an explicit tool list
 * (`parseAgentFields` in `discovery/helpers.ts`), so emitting it keeps the
 * vendored file identical to what the runtime will load.
 */
const YIELD_TOOL = "yield";

const DELIMITER = "---";

/**
 * Rewrite one `.claude/agents/*.md` into OMP's schema.
 *
 * `model` and `maxTurns` are dropped: OMP has no sentinel meaning "inherit"
 * (omitting the key is what defers to the session) and no per-agent turn
 * ceiling. No `output` block is ever emitted — the skill expects prose back,
 * and a schema here collapses the review into an empty envelope.
 */
export function translateClaudeAgent(source: string, fileName: string): string {
	const normalized = source.replace(/\r\n/g, "\n");
	if (!normalized.startsWith(`${DELIMITER}\n`)) {
		throw new Error(`${fileName}: missing front-matter delimiter`);
	}
	const end = normalized.indexOf(`\n${DELIMITER}`, DELIMITER.length);
	if (end === -1) {
		throw new Error(`${fileName}: missing front-matter delimiter`);
	}
	const frontMatter = normalized.slice(DELIMITER.length + 1, end + 1);
	const body = normalized.slice(end + DELIMITER.length + 2).replace(/^\n+/, "");

	const fields = new Map<string, string>();
	for (const line of frontMatter.split("\n")) {
		if (line.trim().length === 0) continue;
		const separator = line.indexOf(":");
		if (separator === -1) continue;
		fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
	}

	const name = fields.get("name");
	if (!name) throw new Error(`${fileName}: front-matter has no name`);
	const description = fields.get("description");
	if (!description) throw new Error(`${fileName}: front-matter has no description`);

	const lines = [DELIMITER, `name: ${name}`, `description: ${quote(description)}`];

	const rawTools = fields.get("tools");
	if (rawTools !== undefined && rawTools.length > 0) {
		const tools = rawTools
			.split(",")
			.map(tool => tool.trim())
			.filter(tool => tool.length > 0)
			.map(tool => {
				// Accept an already-translated name so re-running on our own output
				// is a no-op; that is what keeps a re-vendor from producing a diff.
				if (tool === YIELD_TOOL) return YIELD_TOOL;
				const mapped =
					CLAUDE_TOOL_NAMES[tool] ??
					(Object.values(CLAUDE_TOOL_NAMES).includes(tool) ? tool : undefined);
				if (mapped === undefined) {
					throw new Error(`${fileName}: unrecognised tool name "${tool}"`);
				}
				return mapped;
			});
		const withYield = tools.includes(YIELD_TOOL) ? tools : [...tools, YIELD_TOOL];
		lines.push(`tools: ${withYield.join(", ")}`);
	}

	// `effort` on the way in, `thinkingLevel` on the way back out of our own
	// output, so the translation is a fixed point.
	const effort = fields.get("effort") ?? fields.get("thinkingLevel");
	if (effort !== undefined && effort.length > 0) {
		if (!OMP_THINKING_LEVELS.includes(effort)) {
			throw new Error(
				`${fileName}: effort "${effort}" is not one of ${OMP_THINKING_LEVELS.join(", ")}`,
			);
		}
		lines.push(`thinkingLevel: ${effort}`);
	}

	lines.push(DELIMITER, "");
	return `${lines.join("\n")}\n${body.endsWith("\n") ? body : `${body}\n`}`;
}

/** Double-quoted YAML scalar; upstream descriptions contain apostrophes. */
function quote(value: string): string {
	const unquoted =
		(value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
		(value.startsWith("'") && value.endsWith("'") && value.length > 1)
			? value.slice(1, -1)
			: value;
	return `"${unquoted.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}
