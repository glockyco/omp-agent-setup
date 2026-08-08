import { spawn } from "node:child_process";

export async function readOmpVersion(): Promise<string> {
	return await new Promise<string>((resolveDone, reject) => {
		const child = spawn("omp", ["--version"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", chunk => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", chunk => {
			stderr += chunk.toString();
		});
		child.on("close", (code, signal) => {
			if (signal !== null) {
				reject(new Error(`omp --version terminated by signal: ${signal}`));
				return;
			}
			if (code !== 0) {
				const detail = stderr.trim().replaceAll(/\s+/g, " ");
				reject(new Error(`omp --version exited ${code ?? 1}${detail ? `: ${detail}` : ""}`));
				return;
			}
			const version = stdout.trim();
			if (version.length === 0) {
				reject(new Error("omp --version returned empty output"));
				return;
			}
			resolveDone(version);
		});
		child.on("error", reject);
	});
}

export async function runOmpUpdater(): Promise<number> {
	return await new Promise<number>((resolveDone, reject) => {
		const child = spawn("omp", ["update"], { stdio: "inherit" });
		child.on("close", (code, signal) => {
			if (signal !== null) {
				console.error(`omp update terminated by signal: ${signal}`);
				resolveDone(128);
				return;
			}
			resolveDone(code ?? 1);
		});
		child.on("error", reject);
	});
}
