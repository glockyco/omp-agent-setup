import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { managedAgentChecks, REQUIRED_SKILLS } from "../src/cli.ts";

describe("managedAgentChecks", () => {
	test("includes the global commit skill as a managed symlink", () => {
		const agentDir = "/tmp/omp-agent";

		expect(managedAgentChecks(agentDir)).toContainEqual([
			join(agentDir, "skills", "commit"),
			"skills/commit",
			"symlink",
		]);
	});

	test("requires the global commit skill during verification", () => {
		expect(REQUIRED_SKILLS).toContain("commit");
	});
});
