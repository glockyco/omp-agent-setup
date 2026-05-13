#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
agent_dir="${OMP_AGENT_DIR:-$HOME/.omp/agent}"
extensions_dir="$agent_dir/extensions"
backup_dir="$repo_root/backups/$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$agent_dir" "$extensions_dir" "$backup_dir"

snapshot() {
  local path="$1"
  if [ -e "$path" ] || [ -L "$path" ]; then
    local safe
    safe="$(printf '%s' "$path" | sed 's#^/##; s#[/.]#_#g')"
    cp -a "$path" "$backup_dir/$safe"
  fi
}

snapshot "$agent_dir/config.yml"
snapshot "$agent_dir/AGENTS.md"
snapshot "$extensions_dir/superpowers-bootstrap.ts"
snapshot "$HOME/.omp/plugins/package.json"
snapshot "$HOME/.omp/plugins/omp-plugins.lock.json"

ln -sfn "$repo_root/AGENTS.md" "$agent_dir/AGENTS.md"
ln -sfn "$repo_root/extensions/superpowers-bootstrap.ts" "$extensions_dir/superpowers-bootstrap.ts"

clone_or_update_plugin() {
  local name="$1" path="$2" fork="$3" upstream="$4" branch="$5"
  path="${path/#\~/$HOME}"
  if [ ! -d "$path/.git" ]; then
    mkdir -p "$(dirname "$path")"
    git clone "$fork" "$path"
  fi
  git -C "$path" remote get-url origin >/dev/null
  git -C "$path" remote set-url origin "$fork"
  if git -C "$path" remote get-url upstream >/dev/null 2>&1; then
    git -C "$path" remote set-url upstream "$upstream"
  else
    git -C "$path" remote add upstream "$upstream"
  fi
  if git -C "$path" rev-parse --verify "$branch" >/dev/null 2>&1; then
    git -C "$path" checkout "$branch"
  elif git -C "$path" rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
    git -C "$path" checkout -B "$branch" "origin/$branch"
  else
    printf 'Plugin %s exists but branch %s is missing; leaving current branch unchanged.\n' "$name" "$branch"
  fi
}

clone_or_update_plugin \
  superpowers \
  "~/Projects/superpowers" \
  "https://github.com/glockyco/superpowers.git" \
  "https://github.com/obra/superpowers.git" \
  "omp-local"

clone_or_update_plugin \
  plannotator \
  "~/Projects/plannotator" \
  "https://github.com/glockyco/plannotator.git" \
  "https://github.com/backnotprop/plannotator.git" \
  "omp-local"

config_path="$agent_dir/config.yml"
if [ ! -e "$config_path" ]; then
  cp "$repo_root/config/config.yml.template" "$config_path"
else
  python3 - "$config_path" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
lines = path.read_text().splitlines()
managed = {
    "extensions": [
        "extensions:",
        "  - ~/Projects/plannotator/apps/pi-extension",
        "  - ~/.omp/agent/extensions/superpowers-bootstrap.ts",
    ],
    "skills": [
        "skills:",
        "  customDirectories:",
        "    - ~/Projects/superpowers/skills",
        "    - ~/Projects/plannotator/apps/pi-extension/skills",
    ],
}

def section_name(line: str):
    stripped = line.strip()
    if not stripped or line.startswith((" ", "\t", "-")) or stripped.startswith("#"):
        return None
    if stripped.endswith(":"):
        return stripped[:-1]
    if ":" in stripped:
        return stripped.split(":", 1)[0]
    return None

def replace_section(input_lines, key, replacement):
    out = []
    i = 0
    found = False
    while i < len(input_lines):
        if section_name(input_lines[i]) == key:
            found = True
            out.extend(replacement)
            i += 1
            while i < len(input_lines) and section_name(input_lines[i]) is None:
                i += 1
            continue
        out.append(input_lines[i])
        i += 1
    if not found:
        if out and out[-1].strip():
            out.append("")
        out.extend(replacement)
    return out

for key, replacement in managed.items():
    lines = replace_section(lines, key, replacement)
path.write_text("\n".join(lines).rstrip() + "\n")
PY
fi

printf 'Bootstrap complete. Backups: %s\n' "$backup_dir"
