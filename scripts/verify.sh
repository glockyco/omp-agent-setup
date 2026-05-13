#!/usr/bin/env bash
set -euo pipefail

model="${OMP_VERIFY_MODEL:-openai-codex/gpt-5.5}"

run_and_require() {
  local label="$1" expected="$2"
  shift 2
  local output
  printf '\n==> %s\n' "$label"
  output="$($@)"
  printf '%s\n' "$output"
  if [[ "$output" != *"$expected"* ]]; then
    printf 'Expected output to contain %s\n' "$expected" >&2
    return 1
  fi
  if [[ "$output" == *"Extension error"* ]] || [[ "$output" == *"Failed to load extension"* ]]; then
    printf 'Unexpected extension load error in %s\n' "$label" >&2
    return 1
  fi
}

run_and_require \
  "Direct OMP smoke without skills/extensions" \
  "DIRECT_OK" \
  omp --no-skills --no-extensions -p --no-session "Reply with exactly: DIRECT_OK"

run_and_require \
  "OMP smoke with configured extensions" \
  "OMP_SMOKE_OK" \
  omp -p --no-session --model "$model" "Reply with exactly: OMP_SMOKE_OK"

printf '\n==> Skill discovery: using-superpowers\n'
omp read skill://using-superpowers >/tmp/omp-verify-using-superpowers.txt
printf 'using-superpowers OK\n'

printf '\n==> Skill discovery: brainstorming\n'
omp read skill://brainstorming >/tmp/omp-verify-brainstorming.txt
printf 'brainstorming OK\n'

printf '\n==> Skill discovery: plannotator-review\n'
omp read skill://plannotator-review >/tmp/omp-verify-plannotator-review.txt
printf 'plannotator-review OK\n'

printf '\n==> Superpowers acceptance smoke\n'
acceptance_output="$(omp -p --no-session --model "$model" "Let's make a react todo list")"
printf '%s\n' "$acceptance_output"
if [[ "$acceptance_output" != *"brainstorm"* && "$acceptance_output" != *"Brainstorm"* && "$acceptance_output" != *"superpowers"* && "$acceptance_output" != *"Superpowers"* ]]; then
  printf 'Expected Superpowers acceptance smoke to mention brainstorming or Superpowers.\n' >&2
  return 1 2>/dev/null || exit 1
fi

printf '\nVerification complete. Check /plannotator-status manually in an interactive OMP session after Plannotator command changes.\n'
