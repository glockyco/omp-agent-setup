/** A supported installer channel, so audit remediation names only real install paths. */
export type LspInstallChannel = "bun" | "uv" | "rustup" | "dotnet" | "brew" | "brew-macos";

/**
 * Binaries that the canonical LSP installer can provision, keyed by the exact
 * executable name OMP probes. Keep this registry in lockstep with every
 * `ensure_*` invocation in `scripts/install-lsp.sh`; the audit uses it to avoid
 * promising an installer remediation for a server the script cannot provide.
 */
export const LSP_INSTALL_CHANNELS: Readonly<Record<string, LspInstallChannel>> = {
	"typescript-language-server": "bun",
	tsserver: "bun",
	svelteserver: "bun",
	"vscode-html-language-server": "bun",
	"vscode-css-language-server": "bun",
	"vscode-json-language-server": "bun",
	"vscode-eslint-language-server": "bun",
	"yaml-language-server": "bun",
	"bash-language-server": "bun",
	"tailwindcss-language-server": "bun",
	"docker-langserver": "bun",
	basedpyright: "uv",
	ruff: "uv",
	"rust-analyzer": "rustup",
	"roslyn-language-server": "dotnet",
	taplo: "brew",
	marksman: "brew",
	texlab: "brew",
	jdtls: "brew",
	metals: "brew",
	"lua-language-server": "brew",
	"kotlin-lsp": "brew-macos",
};
