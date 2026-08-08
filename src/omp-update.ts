export type OmpUpdateStage = "update" | "bootstrap" | "doctor" | "verify";

export type ParseOmpUpdateArgsResult =
	| { kind: "run" }
	| { kind: "help" }
	| { kind: "error"; message: string };

export interface OmpUpdateActions {
	readVersion(): Promise<string>;
	update(): Promise<number>;
	bootstrap(): Promise<number>;
	doctor(): Promise<number>;
	verify(): Promise<number>;
}

export type OmpUpdateEvent =
	| { kind: "version"; position: "before" | "after"; value: string }
	| { kind: "stage"; stage: OmpUpdateStage };

export type OmpUpdateWorkflowResult =
	| { kind: "success"; beforeVersion: string; afterVersion: string }
	| { kind: "failure"; stage: OmpUpdateStage; exitCode: number; beforeVersion: string };

const USAGE = "usage: bun run update-omp";
const STAGES: readonly OmpUpdateStage[] = ["update", "bootstrap", "doctor", "verify"];

export function parseOmpUpdateArgs(args: readonly string[]): ParseOmpUpdateArgsResult {
	if (args.length === 0) return { kind: "run" };
	if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
		return { kind: "help" };
	}
	return { kind: "error", message: USAGE };
}

export async function executeOmpUpdateWorkflow(
	actions: OmpUpdateActions,
	observe: (event: OmpUpdateEvent) => void = () => {},
): Promise<OmpUpdateWorkflowResult> {
	const beforeVersion = nonEmptyVersion(await actions.readVersion());
	observe({ kind: "version", position: "before", value: beforeVersion });

	for (const stage of STAGES) {
		observe({ kind: "stage", stage });
		const exitCode = await actions[stage]();
		if (exitCode !== 0) {
			return { kind: "failure", stage, exitCode, beforeVersion };
		}
	}

	const afterVersion = nonEmptyVersion(await actions.readVersion());
	observe({ kind: "version", position: "after", value: afterVersion });
	return { kind: "success", beforeVersion, afterVersion };
}

function nonEmptyVersion(value: string): string {
	const version = value.trim();
	if (version.length === 0) throw new Error("omp --version returned empty output");
	return version;
}
