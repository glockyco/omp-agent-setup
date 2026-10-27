---
name: persona-trials
description: Check instructions, documents, websites, tools, research artifacts or prototypes with subagents that act as the people who will use them. Use when asked for persona, user or reviewer trials, or before publishing material that people outside the author must follow. Covers reading and real trials, unbiased prompts, environment audits, shared state and confirming findings.
---

# Persona trials

A persona trial gives a fresh subagent of the task tool the role of someone who will use the material. The agent works through the material as that person and reports where it hesitated, misread or failed. Trials check the material. They are no evidence about real users, so a paper, a thesis or a report must not present them as a user study or as user feedback.

## Choose the kind of trial

- A reading trial gives the agent the material as text and asks what it would do. It finds unclear wording, missing steps and contradictions. It cannot show that the material works, because agents predict success where real use fails.
- A real trial lets the agent do it: install, run, use the website through the browser, reproduce the artifact. Use it whenever the question is whether the thing works.

Run reading trials while the wording still changes, then real trials on the version you mean to publish. Reviewer personas for a paper draft are reading trials that see only the PDF. Take their review questions from the `research-paper-writing` skill.

## Write the prompts

Put the environment, the rules and the report format in the shared context, and one persona in each task.

- Give the agent only what the person would see, in the order they would see it: the entry link, the pages it leads to, the downloaded files. Leave out the repository, the source, earlier reports and the reason for the trial.
- Describe the persona by platform, prior knowledge, habits, patience, goal and starting state. Do not mention the problems you suspect, and do not ask leading questions about one step.
- Pick personas that differ where the material could fail: first-time users, people who skim, people with a broken earlier setup, other platforms, readers with limited English, experts who check what they run.
- Use fresh agents in every round and keep the persona texts unchanged between rounds, so that a second round shows whether the changes helped.

Shared context template:

```markdown
# Goal
You act as one person using <material> for real. Your persona is in the task.

# Your environment
<What the person has, where things are, and the command or tool that stands for each action the person would take.>

# Rules
- Stay in character. Read as much or as little as the persona would, and make the persona's choices, including mistakes.
- Use only what the persona knows and what you see along the way. Say so if the persona would search the web.
- Do not read <the repository and other places the person cannot see>.
- Change only <the places the person would change>.
- Report honestly. Do not invent problems, and do not smooth over real ones.

# Report
1. Actions: what you did, in order, with the commands you ran.
2. Friction: each hesitation, confusion or mistake, with the exact text involved and what you did next.
3. Outcome: where you ended up, with evidence such as screenshots, logs or output.
4. What you would change, in the persona's own words.
```

## Prepare a real trial

- Audit what the trial machine provides that a real user lacks: tools installed during development, settings, caches, accounts, and paths you hand the agent instead of the way a user finds them. Remove them or set the starting state on purpose. A clean virtual machine, container, browser profile or user account is often the simplest way. When a trial cannot reach a suspected defect, test it directly, for example by removing the setting and observing the failure.
- Map each user action to something the agent can do, and test the mapping before the trial: a command for a button, the browser tool for a website, a screenshot command for looking at the screen. Check that a program the user starts keeps running after the tool call returns. Some agent shells end background processes, so start long-running programs in the foreground with a long timeout.
- Find side effects outside the trial, such as cloud sync, telemetry, email or shared databases, and avoid or contain them.
- When trials share state, such as an installation, a save, a database or an account, run them one after another. Back up the state with a guard that refuses to delete anything without a backup. Reset the starting state before each trial, snapshot the result after it, and restore and compare at the end.

## Use the findings

- Treat each report as a claim. Confirm the outcome yourself from logs, files, the rendered page or the program's output before acting on it.
- Count how many personas hit each problem, and separate defects from wishes. Personas reliably ask for more explanation. Add text only where a persona failed or would have failed, and keep the material's own length and style rules.
- Search for the same defect elsewhere, because a wrong instruction is often repeated on other pages.
- Fix the material, then run a fresh round on the changed version.
- Record the findings and fixes in the change record, not in the material.
