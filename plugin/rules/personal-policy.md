---
alwaysApply: true
description: Personal deviations from the standard OMP engineering policy.
---

# Personal policy

- Verify an interface in its actual host. Use a browser for web interfaces. Use the application, editor, or game for other interfaces.
- During multi-step engineering work, create an atomic commit after each coherent, verified unit. Stage only task-owned changes and inspect the staged diff.
- Use the `personal_commit` tool for commit and amend operations.
- Give every commit a body that explains why the change exists.
- Never push commits or tags without an explicit user request.
- After a push, wait for its checks and fix or report a failure.
- Ask for decisions, approvals and answers in Plannotator: write them as question cards with a marked recommendation in a Markdown file and open it with the `plannotator` tool, because they are easier to read and answer there than in chat. Ask in chat only when Plannotator cannot open, and name the file.
- Write work that should outlive the session into its repository, the `notes` vault or a synced documents folder, never into a temporary directory, because the system deletes files there.
- Change the todo list deliberately: add a new request or side task with `todo append`, and update, finish or drop existing todos one by one. `todo init` replaces the whole list, so use it only when no todo is open or after carrying every open one into the new list.
- Before archiving an OpenSpec change whose remaining tasks moved to another change or repository, record the transfer and its destination in `tasks.md` and turn the transferred tasks into plain bullets. Archive validation and CI reject unchecked tasks in archived changes, and ticking them would claim work completed in this change.
