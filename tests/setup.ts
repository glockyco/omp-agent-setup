/**
 * Test-suite-wide preload. Runs once before any test file.
 *
 * Forces `Bun.which("omp")` to return null so the test suite behaves as if
 * `omp` is not installed — regardless of the dev machine's PATH. Tests that
 * exercise `runBootstrap`, `checkZedSettings`, or any other code path that
 * resolves the `omp` binary MUST inject an explicit path (e.g.
 * `ompPath: "/fake/omp"`).
 *
 * Without this, tests that forget to inject pass locally on a machine with
 * `omp` installed and fail only on CI. See commit history for the original
 * incident (fix(tests): inject ompPath in integration tests so CI without
 * omp passes).
 *
 * All other `Bun.which` lookups pass through unchanged.
 */
const realWhich = Bun.which.bind(Bun);

// biome-ignore lint/suspicious/noExplicitAny: monkey-patching the Bun built-in
(Bun as any).which = (cmd: string, options?: { PATH?: string; cwd?: string }) => {
	if (cmd === "omp") return null;
	return realWhich(cmd, options);
};
