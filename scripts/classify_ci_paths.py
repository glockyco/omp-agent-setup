"""Select native CI from the complete PR diff without paginated file APIs."""

import os
import subprocess


def native_required(event_name, base_sha="", head_sha="", cwd=None):
    if event_name != "pull_request":
        return True
    if not base_sha or not head_sha:
        raise ValueError("PR classification requires base and head commits")
    paths = subprocess.check_output(
        [
            "git", "diff", "--name-only", "--no-renames", "-z",
            f"{base_sha}...{head_sha}", "--",
        ],
        cwd=cwd,
    ).split(b"\0")
    return any(
        not (path.startswith(b"openspec/") or path.endswith((b".md", b".markdown")))
        for path in paths if path
    )


def main():
    needed = native_required(
        os.environ["EVENT_NAME"], os.environ.get("BASE_SHA", ""), os.environ.get("HEAD_SHA", "")
    )
    result = f"native={str(needed).lower()}"
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        print(result, file=output)
    print(result)


if __name__ == "__main__":
    main()
