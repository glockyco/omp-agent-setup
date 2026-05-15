#!/usr/bin/env bash
# Canonical installer for the LSP servers that omp-agent-setup considers
# active across the user's fleet. Idempotent — re-running prints what's
# already installed and only fetches what is missing.
#
# Source-of-truth policy (one channel per tool, see agent/AGENTS.md):
#   bun add -g          JS/TS-ecosystem language servers
#   uv tool install     Python-ecosystem language servers
#   brew install        standalone prebuilt binaries
#   rustup component    Rust toolchain-coupled servers
#   dotnet tool -g      .NET-ecosystem language servers
#
# Run via: bun run install-lsp

set -uo pipefail

c_dim()  { printf '\033[2m%s\033[0m' "$1"; }
c_ok()   { printf '\033[32m%s\033[0m' "$1"; }
c_warn() { printf '\033[33m%s\033[0m' "$1"; }
c_err()  { printf '\033[31m%s\033[0m' "$1"; }

declare -a INSTALLED=()
declare -a ALREADY=()
declare -a FAILED=()
declare -a SKIPPED=()

note() { printf '  %s %s\n' "$(c_dim '·')" "$*"; }
ok()   { printf '  %s %s\n' "$(c_ok  '✓')" "$*"; }
fail() { printf '  %s %s\n' "$(c_err '✗')" "$*"; }
warn() { printf '  %s %s\n' "$(c_warn '!')" "$*"; }

resolve() { command -v "$1" 2>/dev/null; }

ensure_bun_global() {
	local cmd="$1" pkg="$2"
	if resolve "$cmd" >/dev/null; then
		ALREADY+=("$cmd"); ok "$cmd already on PATH"; return 0
	fi
	note "installing $pkg via bun add -g"
	if bun add -g "$pkg" >/dev/null 2>&1; then
		INSTALLED+=("$cmd via bun:$pkg"); ok "$cmd installed"
	else
		FAILED+=("$cmd via bun:$pkg"); fail "$cmd failed to install"
	fi
}

ensure_uv_tool() {
	local cmd="$1" pkg="${2:-$1}"
	if resolve "$cmd" >/dev/null; then
		ALREADY+=("$cmd"); ok "$cmd already on PATH"; return 0
	fi
	if ! resolve uv >/dev/null; then
		SKIPPED+=("$cmd: uv not on PATH"); warn "skipping $cmd (install uv via 'brew install uv')"; return 0
	fi
	note "installing $pkg via uv tool install"
	if uv tool install "$pkg" >/dev/null 2>&1; then
		INSTALLED+=("$cmd via uv:$pkg"); ok "$cmd installed"
	else
		FAILED+=("$cmd via uv:$pkg"); fail "$cmd failed to install"
	fi
}

ensure_brew() {
	local cmd="$1" formula="${2:-$1}"
	if resolve "$cmd" >/dev/null; then
		ALREADY+=("$cmd"); ok "$cmd already on PATH"; return 0
	fi
	if ! resolve brew >/dev/null; then
		SKIPPED+=("$cmd: brew not on PATH"); warn "skipping $cmd (Homebrew missing)"; return 0
	fi
	note "installing $formula via brew"
	if brew install "$formula" >/dev/null 2>&1; then
		INSTALLED+=("$cmd via brew:$formula"); ok "$cmd installed"
	else
		FAILED+=("$cmd via brew:$formula"); fail "$cmd failed to install"
	fi
}

ensure_rust_analyzer() {
	# `command -v rust-analyzer` is not enough: rustup writes a proxy stub at
	# ~/.cargo/bin/rust-analyzer even when the component is not installed for
	# the active toolchain. Invoke it once to confirm the component itself is
	# present before believing the PATH check.
	if resolve rust-analyzer >/dev/null && rust-analyzer --version >/dev/null 2>&1; then
		ALREADY+=("rust-analyzer"); ok "rust-analyzer already on PATH"; return 0
	fi
	if ! resolve rustup >/dev/null; then
		SKIPPED+=("rust-analyzer: rustup not on PATH"); warn "skipping rust-analyzer (install via 'curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y' then re-source ~/.cargo/env)"; return 0
	fi
	note "installing rust-analyzer via rustup component add"
	if rustup component add rust-analyzer >/dev/null 2>&1; then
		INSTALLED+=("rust-analyzer via rustup"); ok "rust-analyzer installed"
	else
		FAILED+=("rust-analyzer via rustup"); fail "rust-analyzer failed to install"
	fi
}

ensure_dotnet_tool() {
	local cmd="$1" pkg="${2:-$1}"
	if resolve "$cmd" >/dev/null; then
		ALREADY+=("$cmd"); ok "$cmd already on PATH"; return 0
	fi
	if ! resolve dotnet >/dev/null; then
		SKIPPED+=("$cmd: dotnet not on PATH"); warn "skipping $cmd (dotnet missing)"; return 0
	fi
	# `dotnet tool list -g` is the authoritative source. A common breakage:
	# the tool is already installed but `~/.dotnet/tools` isn't on $PATH, so
	# `command -v` misses it and we'd try `dotnet tool install -g` again —
	# which exits non-zero for an already-installed tool. Detect first.
	if dotnet tool list -g 2>/dev/null | awk -v pkg="$pkg" '$1 == pkg { found=1 } END { exit !found }'; then
		# Tool is registered. If the literal binary exists under $HOME/.dotnet/tools
		# but `command -v` couldn't find it, the user is hitting the macOS dotnet
		# installer bug: `/etc/paths.d/dotnet-cli-tools` ships with a literal
		# `~/.dotnet/tools` entry that `path_helper` does NOT expand. Surface a
		# concrete fix command rather than letting the tool look 'installed but
		# broken'.
		if [[ -x "$HOME/.dotnet/tools/$cmd" ]] && echo "$PATH" | tr ':' '\n' | grep -qx '~/.dotnet/tools'; then
			FAILED+=("$cmd: /etc/paths.d/dotnet-cli-tools has unexpanded ~ entry")
			fail "$cmd installed at $HOME/.dotnet/tools but PATH has literal '~/.dotnet/tools'; fix with: echo \"\$HOME/.dotnet/tools\" | sudo tee /etc/paths.d/dotnet-cli-tools >/dev/null"
			return 0
		fi
		ALREADY+=("$cmd (installed via dotnet, ensure ~/.dotnet/tools is on PATH)")
		warn "$cmd is installed but not on PATH; add \$HOME/.dotnet/tools to PATH"
		return 0
	fi
	note "installing $pkg via dotnet tool install -g"
	if dotnet tool install -g "$pkg" >/dev/null 2>&1; then
		INSTALLED+=("$cmd via dotnet:$pkg"); ok "$cmd installed"
	else
		FAILED+=("$cmd via dotnet:$pkg"); fail "$cmd failed to install"
	fi
}

main() {
	printf 'install-lsp: canonical LSP install matrix\n'

	printf '\n[bun add -g] JS/TS ecosystem\n'
	ensure_bun_global typescript-language-server typescript-language-server
	ensure_bun_global tsserver typescript
	ensure_bun_global svelteserver svelte-language-server
	ensure_bun_global vscode-html-language-server vscode-langservers-extracted
	ensure_bun_global vscode-css-language-server vscode-langservers-extracted
	ensure_bun_global vscode-json-language-server vscode-langservers-extracted
	ensure_bun_global vscode-eslint-language-server vscode-eslint-language-server
	ensure_bun_global yaml-language-server yaml-language-server
	ensure_bun_global bash-language-server bash-language-server

	printf '\n[uv tool install] Python ecosystem\n'
	ensure_uv_tool basedpyright basedpyright
	ensure_uv_tool ruff ruff

	printf '\n[rustup component] Rust ecosystem\n'
	ensure_rust_analyzer

	printf '\n[dotnet tool -g] .NET ecosystem\n'
	ensure_dotnet_tool csharp-ls csharp-ls

	printf '\n[brew] standalone binaries\n'
	ensure_brew taplo taplo
	ensure_brew marksman marksman
	ensure_brew texlab texlab

	printf '\nSummary\n'
	printf '  installed:  %d\n' "${#INSTALLED[@]}"
	printf '  already:    %d\n' "${#ALREADY[@]}"
	printf '  skipped:    %d\n' "${#SKIPPED[@]}"
	printf '  failed:     %d\n' "${#FAILED[@]}"
	if [[ ${#SKIPPED[@]} -gt 0 ]]; then
		printf '\nSkipped (install the missing prerequisite, then re-run):\n'
		for item in "${SKIPPED[@]}"; do printf '  - %s\n' "$item"; done
	fi
	if [[ ${#FAILED[@]} -gt 0 ]]; then
		printf '\nFailed:\n'
		for item in "${FAILED[@]}"; do printf '  - %s\n' "$item"; done
	fi
	# Anything in SKIPPED means an ecosystem-level installer wasn't on PATH,
	# so the corresponding language servers cannot be installed at all. Treat
	# that as a failure so callers (and the install-lsp wrapper command) do not
	# read a clean exit code as 'fleet provisioned'.
	if [[ ${#FAILED[@]} -gt 0 || ${#SKIPPED[@]} -gt 0 ]]; then
		return 1
	fi
	printf '\nNext: bun run audit-lsp to verify fleet coverage.\n'
	return 0
}

main "$@"
