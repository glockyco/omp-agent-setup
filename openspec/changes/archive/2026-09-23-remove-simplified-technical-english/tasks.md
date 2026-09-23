## 1. Retire the packaged skill

- [x] 1.1 Remove the STE skill directory and its routing sentence from the personal policy; verify a built payload contains neither the skill nor an automatic STE instruction.
- [x] 1.2 Remove the orphaned traceability test and update plugin-load assertions for the remaining skills and absence of STE; verify the targeted plugin test passes.

## 2. Align contracts and documentation

- [x] 2.1 Update current-state README and repository guidance without rewriting historical plans; verify active references describe only shipped skills.
- [x] 2.2 Sync the `personal-omp-plugin` delta and retire the accepted STE capability spec without leaving an empty shell; verify accepted contracts and strict OpenSpec validation agree with the packaged payload.

## 3. Verify the release candidate

- [x] 3.1 Run `nix develop --command bun run ci` and `nix flake check`; verify both release gates pass.
- [x] 3.2 Load the built plugin in an isolated OMP session and verify the remaining skills and policy load without the STE skill or automatic writing-style routing; record observed evidence with the change before archiving it.
