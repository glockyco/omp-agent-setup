import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface LspServerConfig {
	command?: string;
	args?: string[];
	fileTypes?: string[];
	rootMarkers?: string[];
	disabled?: boolean;
}

interface LspConfig {
	servers?: Record<string, LspServerConfig>;
}

function readManagedLspConfig(): LspConfig {
	const text = readFileSync(join(import.meta.dir, "..", "agent", "lsp.json"), "utf8");
	return JSON.parse(text) as LspConfig;
}

function readInstallScript(): string {
	return readFileSync(join(import.meta.dir, "..", "scripts", "install-lsp.sh"), "utf8");
}

describe("managed LSP config", () => {
	test("uses Microsoft's Roslyn LSP as the primary C# server", () => {
		const config = readManagedLspConfig();
		const servers = config.servers ?? {};
		const serverNames = Object.keys(servers);

		expect(servers["roslyn-language-server"]).toMatchObject({
			command: "roslyn-language-server",
			args: ["--stdio", "--autoLoadProjects"],
			fileTypes: [".cs", ".csx"],
			rootMarkers: ["*.sln", "*.slnx", "*.csproj", "global.json"],
		});
		expect(servers["roslyn-language-server"]?.disabled).not.toBe(true);
		expect(serverNames.indexOf("roslyn-language-server")).toBeLessThan(
			serverNames.indexOf("csharp-ls"),
		);
	});

	test("keeps legacy C# servers disabled so diagnostics do not fan out to stale implementations", () => {
		const config = readManagedLspConfig();
		const servers = config.servers ?? {};

		expect(servers["csharp-ls"]?.disabled).toBe(true);
		expect(servers.omnisharp?.disabled).toBe(true);
	});
	test("installer provisions active built-in servers surfaced by fleet audit", () => {
		const script = readInstallScript();

		expect(script).toContain(
			"ensure_bun_global tailwindcss-language-server @tailwindcss/language-server",
		);
		expect(script).toContain("ensure_bun_global docker-langserver dockerfile-language-server-nodejs");
	});
});
