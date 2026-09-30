## 1. Guidance

- [x] 1.1 Add a "Give the reason, not the requester" subsection under "Write the message" in `plugin/skills/commit-policy/SKILL.md`, with a weak attributed body and a strong body stating the reason. Verify that the skill states the rule and both examples.
- [x] 1.2 Add a `body` field description in `plugin/extensions/personal-commit.ts` with the rule. Verify that `bun run ci` passes.

## 2. Verification

- [x] 2.1 Preview a message through the updated extension in a disposable Bun script and confirm that formatting is unchanged. Validate the change with `openspec validate keep-commit-messages-impersonal --strict`.
