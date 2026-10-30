import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import type * as VaultModule from "../plugin/extensions/vault.ts";
import type { CommandResult, Keystore, ProcessRunner } from "../plugin/extensions/vault.ts";

// PERSONAL_PLUGIN_DIR selects an installed release at run time, so the module
// path cannot be static; the default is the source payload.
const pluginRoot = process.env.PERSONAL_PLUGIN_DIR ?? join(import.meta.dir, "..", "plugin");
const {
	clearRegistry,
	createKeystore,
	createVaultExtension,
	formatValue,
	nextMidnight,
	runProcess,
} = (await import(
	pathToFileURL(join(pluginRoot, "extensions", "vault.ts")).href
)) as typeof VaultModule;

// Canary values match no OMP built-in token pattern, so only this extension can redact them.
const PASSWORD = "canary-pw-Kq7!zX";
const MASTER = "master correct horse";
const ITEMS = [
	{
		id: "11111111-aaaa-4bbb-8ccc-000000000001",
		name: "ANITA vLLM external",
		notes: 'multi\nline note "quoted" $HOME',
		login: { username: "anita-service", password: PASSWORD, totp: "otpauth://totp/x?secret=ABC" },
		fields: [{ name: "Api Token", value: "tok_canary_9f8e7d" }],
	},
	{
		id: "11111111-aaaa-4bbb-8ccc-000000000002",
		name: "Other login",
		login: { username: "u", password: "short" },
	},
];

interface BwOptions {
	/** Two-step methods the account has, by bw provider id, with the code each accepts. */
	twoFactor?: Record<string, string>;
	newDevice?: boolean;
}

/** A stub `bw` keyed by data directory, close enough to the real CLI's status machine. */
function fakeBw(options: BwOptions = {}) {
	const accounts = new Map<string, { loggedIn: boolean; key?: string; server?: string }>();
	const calls: Array<{ args: string[]; env: Record<string, string | undefined> }> = [];
	const ok = (stdout = ""): CommandResult => ({ exitCode: 0, stdout, stderr: "" });
	const fail = (message: string): CommandResult => ({ exitCode: 1, stdout: "", stderr: message });
	const run: ProcessRunner = async (command, { env }) => {
		const [binary, ...args] = command;
		if (binary !== "bw") throw new Error(`unexpected command ${binary}`);
		calls.push({ args, env });
		const directory = env.BITWARDENCLI_APPDATA_DIR ?? "";
		const account = accounts.get(directory) ?? { loggedIn: false };
		accounts.set(directory, account);
		const unlocked = account.loggedIn && account.key !== undefined && env.BW_SESSION === account.key;
		const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
		const newKey = () => {
			account.key = randomBytes(64).toString("base64");
			return account.key;
		};
		switch (`${args[0]} ${args[1] ?? ""}`.trim()) {
			case "status":
				return ok(
					JSON.stringify({
						status: !account.loggedIn ? "unauthenticated" : unlocked ? "unlocked" : "locked",
					}),
				);
			case "config server":
				account.server = args[2];
				return ok();
			case "login --apikey":
				if (env.BW_CLIENTID !== "user.client" || env.BW_CLIENTSECRET !== "client-secret")
					return fail("client_id or client_secret is incorrect.");
				account.loggedIn = true;
				return ok("You are logged in!");
			case "unlock --passwordenv": {
				const variable = flag("--passwordenv") ?? "";
				if (env[variable] !== MASTER) return fail("Invalid master password.");
				return ok(newKey());
			}
			case "lock":
				account.key = undefined;
				return ok("Your vault is locked.");
			case "sync":
			case "list items":
			case "get item":
			case "get totp":
				if (!unlocked) return fail("Vault is locked.");
				break;
			default:
				if (args[0] !== "login") return fail(`unknown command ${args.join(" ")}`);
				if (env[flag("--passwordenv") ?? ""] !== MASTER)
					return fail("Username or password is incorrect.");
				if (options.twoFactor) {
					const method = flag("--method");
					const code = flag("--code");
					if (method === undefined) return fail("Code is required.");
					const expected = options.twoFactor[method];
					if (expected === undefined) return fail("Invalid two-step login method.");
					// Asking for the email method without a code sends the email.
					if (code === undefined) return fail("Code is required.");
					if (code !== expected) return fail("Two-step token is invalid. Try again.");
				}
				if (options.newDevice) return fail("Code is required.");
				account.loggedIn = true;
				return ok(newKey());
		}
		if (args[0] === "sync") return ok("Syncing complete.");
		if (args[0] === "list") {
			const search = (flag("--search") ?? "").toLowerCase();
			return ok(JSON.stringify(ITEMS.filter(item => item.name.toLowerCase().includes(search))));
		}
		const item = ITEMS.find(entry => entry.id === args[2]);
		if (!item) return fail("Not found.");
		return ok(args[1] === "totp" ? "123456" : JSON.stringify(item));
	};
	return { run, calls, accounts };
}

function memoryKeystore(): Keystore & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		data,
		read: async vault => data.get(vault),
		write: async (vault, value) => void data.set(vault, value),
		remove: async vault => void data.delete(vault),
	};
}

/** Scripted UI: each select/input takes the next answer and records the prompt. */
function scriptedContext(answers: string[], hasUI = true) {
	const prompts: Array<{ title: string; secret: boolean; kind: string }> = [];
	const take = (kind: string, title: string, secret = false) => {
		prompts.push({ title, secret, kind });
		if (answers.length === 0) throw new Error(`unexpected prompt: ${title}`);
		return Promise.resolve(answers.shift());
	};
	const ctx: ExtensionContext = {
		mode: "tui",
		cwd: tmpdir(),
		hasUI,
		ui: {
			notify: () => {},
			setStatus: () => {},
			select: title => take("select", title),
			input: (title, _placeholder, options) => take("input", title, options?.secret === true),
		},
		sessionManager: {
			getCwd: () => tmpdir(),
			getSessionDir: () => tmpdir(),
			getSessionId: () => "session",
			getArtifactsDir: () => null,
			getLeafId: () => null,
			getBranch: () => [],
		},
	};
	return { ctx, prompts };
}

type Handler = (event: Record<string, unknown>, ctx?: ExtensionContext) => unknown;

function load(deps: { home: string; run: ProcessRunner; keystore: Keystore; now: () => Date }) {
	let tool:
		| { execute: (...args: unknown[]) => Promise<{ content: Array<{ text: string }> }> }
		| undefined;
	const handlers = new Map<string, Handler>();
	const schema = (value: Record<string, unknown>): Record<string, unknown> => ({
		...value,
		optional: () => schema({ ...value, optional: true }),
		describe: () => schema(value),
	});
	createVaultExtension(deps)({
		zod: {
			string: () => schema({ type: "string" }),
			enum: (values: readonly string[]) => schema({ type: "enum", values }),
			object: (shape: Record<string, unknown>) => ({ type: "object", shape }),
		},
		registerTool: (definition: unknown) => {
			tool = definition as unknown as typeof tool;
		},
		on: (event: string, handler: Handler) => handlers.set(event, handler),
	} as unknown as ExtensionAPI);
	if (!tool) throw new Error("vault tool not registered");
	const registered = tool;
	const call = async (params: Record<string, unknown>, ctx: ExtensionContext) =>
		(await registered.execute("call", params, undefined, undefined, ctx)).content[0]?.text ?? "";
	const hook = (event: string) => {
		const handler = handlers.get(event);
		if (!handler) throw new Error(`no ${event} handler`);
		return handler;
	};
	return { call, hook };
}

let home: string;
let clock: Date;

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "vault-test-"));
	clock = new Date(2026, 9, 30, 10, 0, 0);
});

afterEach(() => {
	clearRegistry();
	rmSync(home, { recursive: true, force: true });
});

function setup(options: BwOptions = {}) {
	const bw = fakeBw(options);
	const keystore = memoryKeystore();
	const deps = { home, run: bw.run, keystore, now: () => clock };
	return { bw, keystore, deps, ...load(deps) };
}

const deliver = { action: "file", vault: "scch", id: ITEMS[0]?.id, purpose: "test the key" };

describe("login and unlock", () => {
	test("first use logs in through masked prompts and keeps the password out of arguments", async () => {
		const { bw, keystore, call } = setup();
		const { ctx, prompts } = scriptedContext(["me@scch.at", MASTER]);
		const result = await call({ action: "search", vault: "scch", query: "anita" }, ctx);

		expect(result).toContain("ANITA vLLM external");
		expect(prompts.map(prompt => [prompt.kind, prompt.secret])).toEqual([
			["input", false],
			["input", true],
		]);
		expect(bw.calls.find(entry => entry.args[0] === "config")?.args).toEqual([
			"config",
			"server",
			"https://password.scch.at",
		]);
		for (const entry of bw.calls) expect(entry.args.join(" ")).not.toContain(MASTER);
		const cached = JSON.parse(keystore.data.get("scch") ?? "{}");
		expect(cached.expires).toBe(nextMidnight(clock));
		expect(
			bw.calls.every(
				entry => entry.env.BITWARDENCLI_APPDATA_DIR === join(home, ".omp", "vault", "bw", "scch"),
			),
		).toBe(true);
	});

	const YUBIKEY_CODE = "cccccbhkevrjkrtlfngujrrnkgjrtlkhbeiguetefhec";

	test("one masked prompt takes a YubiKey touch or an authenticator code", async () => {
		for (const [methods, code] of [
			[{ "3": YUBIKEY_CODE }, YUBIKEY_CODE],
			[{ "0": "246810" }, "246810"],
		] as const) {
			const { call } = setup({ twoFactor: methods });
			const { ctx, prompts } = scriptedContext(["me@scch.at", MASTER, code]);
			await call({ action: "search", vault: "scch", query: "" }, ctx);
			expect(prompts.map(prompt => prompt.kind)).toEqual(["input", "input", "input"]);
			expect(prompts.at(-1)?.secret).toBe(true);
			clearRegistry();
			rmSync(home, { recursive: true, force: true });
		}
	});

	test("an empty code requests one by email and asks for it", async () => {
		const { bw, call } = setup({ twoFactor: { "1": "135791" } });
		const { ctx, prompts } = scriptedContext(["me@scch.at", MASTER, "", "135791"]);
		await call({ action: "search", vault: "scch", query: "" }, ctx);
		expect(prompts).toHaveLength(4);
		expect(
			bw.calls.some(entry => entry.args.includes("--method") && !entry.args.includes("--code")),
		).toBe(true);
	});

	test("a wrong or unavailable code fails with the reason instead of asking for an API key", async () => {
		const cases = [
			["000000", /does not use an authenticator app/],
			["", /does not use email/],
			// A YubiKey OTP from another touch: valid modhex, rejected by the server.
			["cccccbhkevrjkrtlfngujrrnkgjrtlkhbeiguetefhed", /Two-step token is invalid/],
		] as const;
		for (const [code, reason] of cases) {
			const { call } = setup({ twoFactor: { "3": YUBIKEY_CODE } });
			const { ctx } = scriptedContext(["me@scch.at", MASTER, code]);
			await expect(call({ action: "search", vault: "scch", query: "" }, ctx)).rejects.toThrow(reason);
		}
	});

	test("falls back to the personal API key for new-device verification and reuses the password", async () => {
		const { bw, call } = setup({ twoFactor: { "0": "246810" }, newDevice: true });
		const { ctx, prompts } = scriptedContext([
			"me@scch.at",
			MASTER,
			"246810",
			"user.client",
			"client-secret",
		]);
		await call({ action: "search", vault: "scch", query: "" }, ctx);
		expect(prompts).toHaveLength(5);
		expect(bw.calls.some(entry => entry.args[0] === "unlock")).toBe(true);
		for (const entry of bw.calls) expect(entry.args.join(" ")).not.toContain("client-secret");
	});

	test("a private vault asks for its server once and remembers it", async () => {
		const { bw, call } = setup();
		const { ctx } = scriptedContext(["Bitwarden EU (vault.bitwarden.eu)", "me@example.org", MASTER]);
		await call({ action: "search", vault: "private", query: "" }, ctx);
		expect(bw.accounts.get(join(home, ".omp", "vault", "bw", "private"))?.server).toBe(
			"https://vault.bitwarden.eu",
		);
		const profiles = JSON.parse(readFileSync(join(home, ".omp", "vault", "profiles.json"), "utf8"));
		expect(profiles).toEqual({ private: "https://vault.bitwarden.eu" });
	});

	test("without an interactive UI a locked vault fails instead of asking in chat", async () => {
		const { call } = setup();
		const { ctx } = scriptedContext([], false);
		await expect(call({ action: "search", vault: "scch", query: "" }, ctx)).rejects.toThrow(
			/interactive OMP session/,
		);
	});

	test("a new process reuses the unlock until midnight, then locks and asks again", async () => {
		const first = setup();
		await first.call(
			{ action: "search", vault: "scch", query: "" },
			scriptedContext(["me@scch.at", MASTER]).ctx,
		);
		await first.call({ ...deliver, field: "password" }, scriptedContext(["Allow always"]).ctx);
		const filesDir = join(home, ".omp", "vault", "files", "scch");
		expect(existsSync(filesDir)).toBe(true);

		// Same keystore and bw state, fresh extension instance: no prompt before midnight.
		const second = load({ ...first.deps });
		await second.call({ action: "search", vault: "scch", query: "" }, scriptedContext([]).ctx);

		clock = new Date(2026, 9, 31, 0, 0, 1);
		const third = load({ ...first.deps });
		const after = scriptedContext([MASTER]);
		await third.call({ action: "search", vault: "scch", query: "" }, after.ctx);
		expect(after.prompts).toHaveLength(1);
		expect(existsSync(filesDir)).toBe(false);
		expect(first.bw.calls.some(entry => entry.args[0] === "lock")).toBe(true);
	});
});

describe("delivery", () => {
	async function unlocked(options: BwOptions = {}) {
		const harness = setup(options);
		await harness.call(
			{ action: "search", vault: "scch", query: "" },
			scriptedContext(["me@scch.at", MASTER]).ctx,
		);
		return harness;
	}

	test("search lists names, ids and fields but no values", async () => {
		const { call } = await unlocked();
		const result = await call(
			{ action: "search", vault: "scch", query: "anita" },
			scriptedContext([]).ctx,
		);
		expect(result).toContain(ITEMS[0]?.id ?? "missing id");
		expect(result).toContain("username, password, totp, notes, Api Token");
		for (const secret of [PASSWORD, "anita-service", "tok_canary_9f8e7d", "multi"])
			expect(result).not.toContain(secret);
	});

	test("writes each format exactly and returns only the path and label", async () => {
		const { call } = await unlocked();
		const cases: Array<[Record<string, unknown>, string]> = [
			[{ field: "password" }, PASSWORD],
			[{ field: "password", format: "dotenv", name: "VLLM_API_KEY" }, `VLLM_API_KEY='${PASSWORD}'\n`],
			[
				{ field: "Api Token", format: "header", name: "Authorization" },
				"Authorization: tok_canary_9f8e7d\n",
			],
			[
				{ field: "notes", format: "dotenv", name: "NOTE" },
				'NOTE="multi\\nline note \\"quoted\\" $HOME"\n',
			],
		];
		for (const [index, [params, expected]] of cases.entries()) {
			const answers = index === 0 ? ["Allow always"] : [];
			const result = await call({ ...deliver, ...params }, scriptedContext(answers).ctx);
			const path = result.match(/is in (.+)\n/u)?.[1] ?? "";
			expect(readFileSync(path, "utf8")).toBe(expected);
			expect(result).toContain("[vault:scch/ANITA vLLM external/");
			for (const secret of [PASSWORD, "tok_canary_9f8e7d", "multi\nline"])
				expect(result).not.toContain(secret);
			if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600);
		}
	});

	test("a header value with a line break is refused", () => {
		expect(() => formatValue("a\nb", "header", "X-Token")).toThrow(/line break/);
		expect(() => formatValue("a", "dotenv", "BAD NAME")).toThrow(/variable name/);
	});

	test("remembered deny refuses without fetching the entry, allow once asks again", async () => {
		const { bw, call } = await unlocked();
		await call({ ...deliver, field: "username" }, scriptedContext(["Allow once"]).ctx);
		const again = scriptedContext(["Deny"]);
		await expect(call({ ...deliver, field: "username" }, again.ctx)).rejects.toThrow(/denied/);
		expect(again.prompts).toHaveLength(1);

		const fetches = bw.calls.filter(entry => entry.args[1] === "item").length;
		const third = scriptedContext([]);
		await expect(call({ ...deliver, field: "username" }, third.ctx)).rejects.toThrow(
			/denied for agents/,
		);
		expect(third.prompts).toHaveLength(0);
		expect(bw.calls.filter(entry => entry.args[1] === "item")).toHaveLength(fetches);
	});
});

describe("redaction", () => {
	async function delivered() {
		const harness = setup();
		await harness.call(
			{ action: "search", vault: "scch", query: "" },
			scriptedContext(["me@scch.at", MASTER]).ctx,
		);
		await harness.call({ ...deliver, field: "password" }, scriptedContext(["Allow always"]).ctx);
		return harness;
	}
	const label = "[vault:scch/ANITA vLLM external/password]";

	test("tool results, context and provider payloads carry the label instead of the value", async () => {
		const { hook } = await delivered();
		const result = hook("tool_result")({
			content: [{ type: "text", text: `echo: ${PASSWORD}` }],
			details: { nested: [`x${PASSWORD}y`] },
		}) as { content: Array<{ text: string }>; details: { nested: string[] } };
		expect(result.content[0]?.text).toBe(`echo: ${label}`);
		expect(result.details.nested[0]).toBe(`x${label}y`);

		const context = hook("context")({
			messages: [{ role: "toolResult", content: [{ type: "text", text: PASSWORD }] }],
		}) as {
			messages: unknown[];
		};
		expect(JSON.stringify(context.messages)).not.toContain(PASSWORD);

		const payload = hook("before_provider_request")({
			payload: { input: [{ content: `a ${PASSWORD} b` }] },
		});
		expect(JSON.stringify(payload)).toBe(JSON.stringify({ input: [{ content: `a ${label} b` }] }));
	});

	test("hooks leave clean content untouched and short values alone", async () => {
		const { hook, call } = await delivered();
		expect(
			hook("tool_result")({ content: [{ type: "text", text: "nothing here" }], details: {} }),
		).toBeUndefined();
		expect(hook("before_provider_request")({ payload: { text: "clean" } })).toBeUndefined();
		await call(
			{ ...deliver, id: ITEMS[1]?.id, field: "password" },
			scriptedContext(["Allow once"]).ctx,
		);
		expect(
			hook("tool_result")({ content: [{ type: "text", text: "short" }], details: {} }),
		).toBeUndefined();
	});

	test("a tool call that contains a delivered value is blocked", async () => {
		const { hook } = await delivered();
		expect(
			hook("tool_call")({ toolName: "bash", input: { command: `curl -u x:${PASSWORD}` } }),
		).toMatchObject({ block: true });
		expect(hook("tool_call")({ toolName: "bash", input: { command: "ls" } })).toBeUndefined();
	});

	test("a new process redacts today's delivered values without unlocking", async () => {
		const first = await delivered();
		clearRegistry();
		const second = load({ ...first.deps, keystore: memoryKeystore() });
		await second.hook("session_start")({});
		const result = second.hook("tool_result")({
			content: [{ type: "text", text: PASSWORD }],
			details: undefined,
		}) as {
			content: Array<{ text: string }>;
		};
		expect(result.content[0]?.text).toBe(label);
	});
});

describe("errors and lifecycle", () => {
	async function unlocked() {
		const harness = setup();
		await harness.call(
			{ action: "search", vault: "scch", query: "" },
			scriptedContext(["me@scch.at", MASTER]).ctx,
		);
		return harness;
	}

	test("lock deletes the delivery files and forgets the unlock", async () => {
		const { call, keystore } = await unlocked();
		await call({ ...deliver, field: "password" }, scriptedContext(["Allow always"]).ctx);
		expect(await call({ action: "lock", vault: "scch" }, scriptedContext([]).ctx)).toContain(
			"Locked",
		);
		expect(existsSync(join(home, ".omp", "vault", "files", "scch"))).toBe(false);
		expect(keystore.data.has("scch")).toBe(false);
		const again = scriptedContext([MASTER]);
		await call({ action: "search", vault: "scch", query: "" }, again.ctx);
		expect(again.prompts).toHaveLength(1);
	});

	test("a wrong master password is asked again", async () => {
		const { call } = await unlocked();
		await call({ action: "lock", vault: "scch" }, scriptedContext([]).ctx);
		const retry = scriptedContext(["wrong", MASTER]);
		await call({ action: "search", vault: "scch", query: "" }, retry.ctx);
		expect(retry.prompts.every(prompt => prompt.secret)).toBe(true);
		expect(retry.prompts).toHaveLength(2);
	});

	test("missing fields, unknown entries and bad vault names fail with a usable message", async () => {
		const { call } = await unlocked();
		await expect(
			call({ ...deliver, field: "pin" }, scriptedContext(["Allow always"]).ctx),
		).rejects.toThrow(/no field "pin".*username, password/);
		await expect(call({ ...deliver }, scriptedContext([]).ctx)).rejects.toThrow(/needs id and field/);
		await expect(
			call({ ...deliver, id: "missing", field: "password" }, scriptedContext([]).ctx),
		).rejects.toThrow(/bw get failed: Not found/);
		await expect(
			call({ action: "search", vault: "Bad Name", query: "" }, scriptedContext([]).ctx),
		).rejects.toThrow(/vault names/);
	});

	test("totp and custom fields resolve by name, custom fields case-insensitively", async () => {
		const { call } = await unlocked();
		const totp = await call({ ...deliver, field: "totp" }, scriptedContext(["Allow always"]).ctx);
		expect(readFileSync(totp.match(/is in (.+)\n/u)?.[1] ?? "", "utf8")).toBe("123456");
		const token = await call({ ...deliver, field: "api token" }, scriptedContext([]).ctx);
		expect(readFileSync(token.match(/is in (.+)\n/u)?.[1] ?? "", "utf8")).toBe("tok_canary_9f8e7d");
	});

	test("a missing bw executable is reported as a host prerequisite", async () => {
		const missing: ProcessRunner = async () => {
			throw Object.assign(new Error("spawn bw ENOENT"), { code: "ENOENT" });
		};
		const { call } = load({ home, run: missing, keystore: memoryKeystore(), now: () => clock });
		await expect(
			call({ action: "search", vault: "scch", query: "" }, scriptedContext([]).ctx),
		).rejects.toThrow(/Bitwarden CLI \(bw\) is not on PATH/);
	});
});

describe("host boundaries", () => {
	test("the process runner passes stdin and returns output and exit code", async () => {
		const result = await runProcess(
			[process.execPath, "-e", "process.stdout.write(await Bun.stdin.text()); process.exit(3)"],
			{ env: { ...process.env }, stdin: "piped" },
		);
		expect(result).toEqual({ exitCode: 3, stdout: "piped", stderr: "" });
	});

	test("the Windows and macOS keystores never put the stored data in process arguments", async () => {
		const data = JSON.stringify({ key: "unlock-key-canary", issued: 1, expires: 2 });
		const seen: string[][] = [];
		const store = new Map<string, string>();
		const fake: ProcessRunner = async (command, { stdin }) => {
			seen.push(command);
			const done = (stdout = "", exitCode = 0) => ({ exitCode, stdout, stderr: "" });
			if (command[0] === "powershell.exe") {
				if ((command.at(-1) ?? "").includes("Unprotect")) return done(store.get(stdin?.trim() ?? ""));
				store.set("CIPHER", stdin ?? "");
				return done("CIPHER\r\n");
			}
			if (command[1] === "-i") {
				const hex = stdin?.match(/-X ([0-9a-f]+)/u)?.[1] ?? "";
				store.set("keychain", Buffer.from(hex, "hex").toString("utf8"));
				return done();
			}
			if (command[1] === "find-generic-password") {
				const value = store.get("keychain");
				return value ? done(`${value}\n`) : done("", 44);
			}
			store.delete("keychain");
			return done();
		};
		for (const platform of ["win32", "darwin", "linux"] as const) {
			const keystore = createKeystore(platform, home, fake);
			await keystore.write("scch", data);
			expect(await keystore.read("scch")).toBe(data);
			await keystore.remove("scch");
			expect(await keystore.read("scch")).toBeUndefined();
		}
		for (const command of seen) expect(command.join(" ")).not.toContain("unlock-key-canary");
	});
});
