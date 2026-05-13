#!/usr/bin/env bash
set -euo pipefail

repo="$HOME/Projects/superpowers"
branch="omp-local"

git -C "$repo" status --short --branch
git -C "$repo" fetch upstream
git -C "$repo" fetch origin
if git -C "$repo" rev-parse --verify "$branch" >/dev/null 2>&1; then
  git -C "$repo" checkout "$branch"
else
  git -C "$repo" checkout -b "$branch"
fi
printf 'Review upstream changes, then merge or rebase upstream/main and run scripts/verify.sh from omp-agent-setup.\n'
