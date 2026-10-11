import { appendFileSync } from "node:fs";
import { basename } from "node:path";

const python = basename(process.execPath).startsWith("python");
if (process.env.NATIVE_GATE_FIXTURE_LOG) {
	appendFileSync(
		process.env.NATIVE_GATE_FIXTURE_LOG,
		`${JSON.stringify({
			python,
			args: process.argv.slice(2),
			cwd: process.cwd(),
			home: process.env.HOME,
			profile: process.env.USERPROFILE,
			appdata: process.env.APPDATA,
			localappdata: process.env.LOCALAPPDATA,
			temp: process.env.TEMP,
			tmp: process.env.TMP,
		})}\n`,
	);
}
if (process.argv[2] === "--version") {
	console.log(
		python
			? `Python ${process.env.NATIVE_GATE_FIXTURE_PYTHON_VERSION ?? "3.13.14"}`
			: `omp/${process.env.NATIVE_GATE_FIXTURE_OMP_VERSION ?? "18.8.7"}`,
	);
} else if (python && process.argv[2]?.endsWith("release_gate.py")) {
	process.exit(Number(process.env.NATIVE_GATE_FIXTURE_EXIT_CODE ?? "0"));
} else {
	console.error("Unexpected native gate boundary invocation");
	process.exit(41);
}
