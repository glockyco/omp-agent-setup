import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const MARKER = "<SUPERPOWERS_BOOTSTRAP>";
const END_MARKER = "</SUPERPOWERS_BOOTSTRAP>";
const DEFAULT_SUPERPOWERS_ROOT = "~/Projects/superpowers";

function expandHome(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return join(homedir(), path.slice(2));
	return path;
}

function superpowersRoot(): string {
	return expandHome(process.env.SUPERPOWERS_ROOT ?? DEFAULT_SUPERPOWERS_ROOT);
}

function alreadyInjected(systemPrompt: readonly string[]): boolean {
	return systemPrompt.some(block => block.includes(MARKER));
}

export default function superpowersBootstrap(pi: ExtensionAPI): void {
	let cachedPrompt: string | undefined;
	let cachedRoot: string | undefined;

	pi.on("before_agent_start", async event => {
		if (alreadyInjected(event.systemPrompt)) {
			return undefined;
		}

		const root = superpowersRoot();
		const skillPath = join(root, "skills", "using-superpowers", "SKILL.md");

		try {
			if (cachedPrompt === undefined || cachedRoot !== root) {
				const content = await readFile(skillPath, "utf8");
				cachedPrompt = `${MARKER}\n${content}\n${END_MARKER}`;
				cachedRoot = root;
			}
			return { systemPrompt: [...event.systemPrompt, cachedPrompt] };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			pi.logger.error(`Superpowers bootstrap unavailable at ${skillPath}: ${message}`);
			return {
				message: {
					customType: "superpowers-bootstrap-error",
					content: `Superpowers bootstrap unavailable at ${skillPath}: ${message}`,
					display: true,
					attribution: "system",
				},
			};
		}
	});
}
