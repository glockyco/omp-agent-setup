import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import {
	checkOmpVersion,
	cleanupReleaseOmp,
	isolatedEnvironment,
	setupReleaseOmp,
} from "./setup-release-omp.ts";

const repository = resolve(import.meta.dir, "..");

/** PYTHON_BIN is one executable, never a shell command with embedded arguments. */
export function pythonExecutable(
	env: NodeJS.ProcessEnv = process.env,
	platform = process.platform,
): string {
	return (
		env.PYTHON_BIN ??
		join(
			repository,
			".venv",
			platform === "win32" ? "Scripts" : "bin",
			platform === "win32" ? "python.exe" : "python",
		)
	);
}

export async function checkInstalledRelease(): Promise<void> {
	let setup: { root: string; binary: string } | undefined;
	let scratch: string | undefined;
	try {
		const configured = process.env.OMP_BIN;
		if (configured && !isAbsolute(configured))
			throw new Error("OMP_BIN must be an absolute pinned official binary path");
		let binary = configured;
		if (!binary) {
			setup = await setupReleaseOmp();
			binary = setup.binary;
		}
		scratch = await mkdtemp(join(tmpdir(), "personal release launcher "));
		const env = {
			...(await isolatedEnvironment(scratch)),
			OMP_BIN: binary,
			PYTHONDONTWRITEBYTECODE: "1",
			PYTHONUTF8: "1",
		};
		await checkOmpVersion(binary, env);
		const python = pythonExecutable();
		const version = Bun.spawnSync([python, "--version"], {
			env,
			stdout: "pipe",
			stderr: "pipe",
			timeout: 30_000,
		});
		const observed = `${version.stdout}${version.stderr}`.trim();
		if (version.exitCode !== 0 || !/^Python 3\.13\.\d+(?:\s|$)/.test(observed))
			throw new Error(
				`release gate Python: expected 3.13, observed ${observed || "unavailable"} (${python})`,
			);
		const child = Bun.spawn([python, join(repository, "tests", "release_gate.py")], {
			cwd: repository,
			env,
			stdin: "ignore",
			stdout: "inherit",
			stderr: "inherit",
		});
		const code = await child.exited;
		if (code !== 0) throw new Error(`installed-release gate failed with exit code ${code}`);
	} finally {
		if (scratch) await rm(scratch, { recursive: true, force: true });
		if (setup) await cleanupReleaseOmp(setup.root);
	}
}

if (import.meta.main) {
	try {
		await checkInstalledRelease();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
