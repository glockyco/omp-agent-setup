# Global OMP agent setup

- Primary harness: Oh My Pi / OMP (`omp`), specifically https://github.com/can1357/oh-my-pi. Do not assume regular Pi behavior unless verified against OMP.
- Primary models are routed through OMP; common models are Claude Opus 4.7 and OpenAI GPT-5.5.
- Global methodology is Superpowers, adapted locally at `~/Projects/superpowers`.
- Global plan/review UI is Plannotator, adapted locally at `~/Projects/plannotator`.
- OMP global config lives at `~/.omp/agent/config.yml`.
- OMP global agent instructions live here: `~/.omp/agent/AGENTS.md`.
- Prefer OMP-native `.omp` paths over `.pi` and prefer `AGENTS.md` over `CLAUDE.md`.
- For tiny tasks, the user may explicitly opt out of Superpowers process. User instructions override Superpowers skills.
- If Superpowers seems inactive, verify `skill://using-superpowers`, `skill://brainstorming`, and the Superpowers bootstrap extension before proceeding.
- If Plannotator seems inactive, verify the local extension path `~/Projects/plannotator/apps/pi-extension` and check OMP logs for extension load errors.
- Do not add repo-local plugin copies unless a repo needs a genuine override.
