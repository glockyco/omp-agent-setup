import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { dirname } from "node:path";

if (process.argv[2] === "--descendant") {
	process.on("SIGTERM", () => {});
	setInterval(() => {}, 1000);
} else {
	const path = process.argv[3];
	if (!path) throw new Error("Missing snapshot argv");
	const mode = await Bun.file("mode")
		.text()
		.catch(() => "normal");
	let descendant: number | undefined;
	if (mode === "descendant") {
		const child = spawn(process.execPath, ["--descendant"], { stdio: "ignore" });
		descendant = child.pid;
	}
	process.on("SIGTERM", () => {
		console.log(JSON.stringify({ decision: "annotated", feedback: "Late cancellation feedback" }));
		process.exit(0);
	});
	await Bun.write(
		"ready.json",
		JSON.stringify({
			pid: process.pid,
			descendant,
			path,
			text: await Bun.file(path).text(),
			fileMode: statSync(path).mode & 0o777,
			directoryMode: statSync(dirname(path)).mode & 0o777,
			environment: Object.fromEntries(
				Object.entries(process.env).filter(
					([key]) => key.startsWith("PLANNOTATOR_") || key === "BROWSER",
				),
			),
		}),
	);
	if (mode === "startup-error") {
		console.error("fixture startup failure");
		process.exit(2);
	}
	while (!(await Bun.file("result.json").exists())) await Bun.sleep(10);
	process.stdout.write(await Bun.file("result.json").text());
}
