/** Conventional Commits configuration aligned with the project commit skill. */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "refactor",
        "perf",
        "docs",
        "style",
        "test",
        "chore",
        "build",
        "ci",
        "revert",
      ],
    ],
    "subject-case": [0],
    "header-max-length": [2, "always", 80],
    "body-max-line-length": [0],
  },
};
