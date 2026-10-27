## ADDED Requirements

### Requirement: Persona trials skill

The plugin SHALL ship a `persona-trials` skill for checking material or a product with agents that act as the people who will use it. The skill SHALL cover choosing between trials that read the material and trials that use the real thing, keeping agents free of the author's assumptions, finding what the trial environment provides that real users lack, protecting shared state, and confirming findings. It SHALL work on every native host platform.

#### Scenario: Discover the skill

- **WHEN** OMP starts with the manager-installed personal plugin in any working directory
- **THEN** the `persona-trials` skill is discoverable

#### Scenario: Plan a trial

- **WHEN** an agent plans persona trials for install instructions, a website, a research artifact or a document
- **THEN** the skill tells it what each agent may see, how to describe a persona without the author's suspicions, and which findings to confirm independently before acting on them

#### Scenario: Report trial results in research

- **WHEN** persona trial results could appear in a paper, a thesis or another research report
- **THEN** the skill states that the results are not evidence about real users and must not be reported as a user study
