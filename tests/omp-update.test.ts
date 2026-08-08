import { describe, expect, test } from "bun:test";
import {
	executeOmpUpdateWorkflow,
	type OmpUpdateActions,
	type OmpUpdateEvent,
	type OmpUpdateStage,
	parseOmpUpdateArgs,
} from "../src/omp-update.ts";

describe("parseOmpUpdateArgs", () => {
	test("accepts only no arguments for a run", () => {
		expect(parseOmpUpdateArgs([])).toEqual({ kind: "run" });
	});

	test.each([["--help"], ["-h"]])("accepts exactly one help flag", flag => {
		expect(parseOmpUpdateArgs([flag])).toEqual({ kind: "help" });
	});

	test.each([
		{ args: ["--force"] },
		{ args: ["--help", "extra"] },
		{ args: ["check"] },
	])("rejects unsupported arguments", ({ args }) => {
		expect(parseOmpUpdateArgs(args)).toEqual({
			kind: "error",
			message: "usage: bun run update-omp",
		});
	});
});

describe("executeOmpUpdateWorkflow", () => {
	function makeActions(codes: Partial<Record<OmpUpdateStage, number>> = {}): {
		actions: OmpUpdateActions;
		calls: string[];
	} {
		const calls: string[] = [];
		let versionRead = 0;
		const stage = (name: OmpUpdateStage) => async () => {
			calls.push(name);
			return codes[name] ?? 0;
		};
		return {
			calls,
			actions: {
				async readVersion() {
					const position = versionRead++ === 0 ? "before" : "after";
					calls.push(`version-${position}`);
					return position === "before" ? "1.2.3" : "1.2.4";
				},
				update: stage("update"),
				bootstrap: stage("bootstrap"),
				doctor: stage("doctor"),
				verify: stage("verify"),
			},
		};
	}

	test("runs every stage and version read in order", async () => {
		const { actions, calls } = makeActions();
		const events: OmpUpdateEvent[] = [];

		const result = await executeOmpUpdateWorkflow(actions, event => events.push(event));

		expect(calls).toEqual([
			"version-before",
			"update",
			"bootstrap",
			"doctor",
			"verify",
			"version-after",
		]);
		expect(events).toEqual([
			{ kind: "version", position: "before", value: "1.2.3" },
			{ kind: "stage", stage: "update" },
			{ kind: "stage", stage: "bootstrap" },
			{ kind: "stage", stage: "doctor" },
			{ kind: "stage", stage: "verify" },
			{ kind: "version", position: "after", value: "1.2.4" },
		]);
		expect(result).toEqual({
			kind: "success",
			beforeVersion: "1.2.3",
			afterVersion: "1.2.4",
		});
	});

	test.each([
		["update", ["version-before", "update"]],
		["bootstrap", ["version-before", "update", "bootstrap"]],
		["doctor", ["version-before", "update", "bootstrap", "doctor"]],
		["verify", ["version-before", "update", "bootstrap", "doctor", "verify"]],
	] as const)("stops after a nonzero %s result", async (failedStage, expectedCalls) => {
		const { actions, calls } = makeActions({ [failedStage]: 17 });

		const result = await executeOmpUpdateWorkflow(actions);

		expect(calls).toEqual([...expectedCalls]);
		expect(result).toEqual({
			kind: "failure",
			stage: failedStage,
			exitCode: 17,
			beforeVersion: "1.2.3",
		});
	});

	test("rejects an empty version before running a stage", async () => {
		const { actions, calls } = makeActions();
		actions.readVersion = async () => "  ";

		expect(executeOmpUpdateWorkflow(actions)).rejects.toThrow("omp --version returned empty output");
		expect(calls).toEqual([]);
	});
});
