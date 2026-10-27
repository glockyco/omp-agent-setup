## Why

Agents that play the people who will use something, such as a player following install instructions, an artifact evaluator or a reviewer, find defects that the author's own review misses. A first use on 2026-10-27 showed that the value lies in how such trials are run, not in the idea. Trials that only read the material predicted success where real installs failed, the test machine hid a defect that every new user would hit, and the agent harness killed background processes. Without a shared method each session rediscovers these costs, and the method applies to every repository on both hosts.

## What Changes

- Add a `persona-trials` skill that describes how to run trials with agents acting as users: when a trial reads material and when it uses the real thing, how to keep agents free of the author's assumptions, how to find what the trial environment gives for free, how to protect and restore shared state, and how to sort and confirm findings.
- State the skill's scope and its limit: the trials check material and products, and their results are never evidence about real users, for example in a paper or a thesis.
- Check the skill in the release-tree validation, the plugin-load test and the release gate.
- List the skill in the README.
- Release the change as a new minor version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Ship the `persona-trials` skill.

## Impact

Sessions on upgraded hosts discover the skill from any working directory on Korolev and the Mac. The skill names what trial tools must do rather than shipping tools, so it adds no runtime dependency and works on every native platform. Hosts keep the previous behavior until they upgrade.
