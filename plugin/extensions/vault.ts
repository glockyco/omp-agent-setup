import { randomBytes } from "node:crypto";
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

export interface CommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export type ProcessRunner = (
	command: string[],
	options: { env: Record<string, string | undefined>; stdin?: string },
) => Promise<CommandResult>;

/** Stores one opaque string per vault in the OS keystore. */
export interface Keystore {
	read(vault: string): Promise<string | undefined>;
	write(vault: string, data: string): Promise<void>;
	remove(vault: string): Promise<void>;
}

export interface VaultDeps {
	home: string;
	run: ProcessRunner;
	keystore: Keystore;
	now: () => Date;
}

export type FileFormat = "raw" | "dotenv" | "header";
type Approval = "always" | "deny";

interface CacheEntry {
	key: string;
	issued: number;
	expires: number;
}

interface Delivery {
	file: string;
	label: string;
	value: string;
	expires: number;
}

interface BwItem {
	id: string;
	name: string;
	notes?: string | null;
	login?: { username?: string | null; password?: string | null; totp?: string | null } | null;
	fields?: Array<{ name?: string | null; value?: string | null }> | null;
}

/** Values shorter than this are not redacted, because replacing them would corrupt ordinary output. */
export const MIN_REDACTED_LENGTH = 6;
const KNOWN_SERVERS: Record<string, string> = { scch: "https://password.scch.at" };
const SERVER_CHOICES = new Map([
	["Bitwarden US (vault.bitwarden.com)", "https://vault.bitwarden.com"],
	["Bitwarden EU (vault.bitwarden.eu)", "https://vault.bitwarden.eu"],
]);
const CUSTOM_SERVER = "Another server";
// bw's two-step provider ids.
const TWO_STEP_METHODS = new Map([
	["Authenticator app", "0"],
	["Email", "1"],
	["YubiKey OTP", "3"],
]);
const NO_TWO_STEP = "No two-step login is set up";
const APPROVAL_CHOICES = ["Allow always", "Allow once", "Deny"] as const;
const VAULT_NAME = /^[a-z][a-z0-9-]{0,31}$/u;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
const PLAIN_DOTENV = /^[A-Za-z0-9_@%+=:,./-]*$/u;

// ---------------------------------------------------------------------------
// Redaction registry, shared by every session in this OMP process so that a
// subagent's deliveries are redacted in its parent as well.
// ---------------------------------------------------------------------------

interface Registry {
	labels: Map<string, string>;
	sorted: Array<[string, string]>;
}

const REGISTRY_KEY = Symbol.for("personal@glockyco/vault/registry");

function registry(): Registry {
	const store = globalThis as unknown as Record<symbol, Registry | undefined>;
	store[REGISTRY_KEY] ??= { labels: new Map(), sorted: [] };
	return store[REGISTRY_KEY];
}

export function registerValue(value: string, label: string): void {
	if (value.length < MIN_REDACTED_LENGTH) return;
	const reg = registry();
	if (reg.labels.get(value) === label) return;
	reg.labels.set(value, label);
	// Longest first, so a value that contains another value is replaced whole.
	reg.sorted = [...reg.labels].sort((a, b) => b[0].length - a[0].length);
}

/** Test seam: forget every registered value. */
export function clearRegistry(): void {
	const reg = registry();
	reg.labels.clear();
	reg.sorted = [];
}

export function redactText(text: string): string {
	let result = text;
	for (const [value, label] of registry().sorted) {
		if (result.includes(value)) result = result.split(value).join(label);
	}
	return result;
}

export function containsValue(text: string): boolean {
	for (const [value] of registry().sorted) if (text.includes(value)) return true;
	return false;
}

/**
 * Replace registered values in every string of a JSON-like structure. Returns
 * the same object when nothing changed, so callers can leave OMP's value alone.
 */
export function redactDeep<T>(input: T): T {
	if (registry().sorted.length === 0) return input;
	const seen = new WeakMap<object, unknown>();
	const visit = (node: unknown): unknown => {
		if (typeof node === "string") return redactText(node);
		if (node === null || typeof node !== "object") return node;
		if (seen.has(node)) return seen.get(node);
		if (Array.isArray(node)) {
			seen.set(node, node);
			let changed = false;
			const copy = node.map(item => {
				const next = visit(item);
				if (next !== item) changed = true;
				return next;
			});
			const result = changed ? copy : node;
			seen.set(node, result);
			return result;
		}
		const prototype = Object.getPrototypeOf(node);
		if (prototype !== Object.prototype && prototype !== null) return node;
		seen.set(node, node);
		let changed = false;
		const copy: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(node)) {
			const next = visit(value);
			if (next !== value) changed = true;
			copy[key] = next;
		}
		const result = changed ? copy : node;
		seen.set(node, result);
		return result;
	};
	return visit(input) as T;
}

// ---------------------------------------------------------------------------
// File formats
// ---------------------------------------------------------------------------

export function formatValue(value: string, format: FileFormat, name?: string): string {
	if (format === "raw") return value;
	if (!name) throw new Error(`format ${format} needs a name`);
	if (format === "dotenv") {
		if (!ENV_NAME.test(name)) throw new Error("dotenv name must be a valid variable name");
		return `${name}=${quoteDotenv(value)}\n`;
	}
	if (!HEADER_NAME.test(name)) throw new Error("header name must be a valid HTTP header name");
	if (/[\r\n]/u.test(value))
		throw new Error("the value contains a line break and cannot be a header");
	return `${name}: ${value}\n`;
}

function quoteDotenv(value: string): string {
	if (PLAIN_DOTENV.test(value)) return value;
	if (!value.includes("'") && !/[\r\n]/u.test(value)) return `'${value}'`;
	return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"').replace(/\r/gu, "\\r").replace(/\n/gu, "\\n")}"`;
}

/** The next local midnight after `now`, in milliseconds. */
export function nextMidnight(now: Date): number {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
}

// ---------------------------------------------------------------------------
// Vault service
// ---------------------------------------------------------------------------

class VaultError extends Error {}

export class VaultService {
	readonly #deps: VaultDeps;
	readonly #root: string;
	readonly #keys = new Map<string, CacheEntry>();
	readonly #pending = new Map<string, Promise<string>>();
	readonly #synced = new Set<string>();

	constructor(deps: VaultDeps) {
		this.#deps = deps;
		this.#root = join(deps.home, ".omp", "vault");
	}

	get root(): string {
		return this.#root;
	}

	/** Re-register today's delivered values and delete deliveries from earlier days. */
	async reload(): Promise<void> {
		const filesRoot = join(this.#root, "files");
		let vaults: string[];
		try {
			vaults = await readdir(filesRoot);
		} catch {
			return;
		}
		const now = this.#deps.now().getTime();
		for (const vault of vaults) {
			const deliveries = await this.#readIndex(vault);
			if (deliveries.some(delivery => delivery.expires <= now)) {
				await rm(join(filesRoot, vault), { recursive: true, force: true });
				continue;
			}
			for (const delivery of deliveries) registerValue(delivery.value, delivery.label);
		}
	}

	async search(vault: string, query: string, ctx: ExtensionContext): Promise<string> {
		const key = await this.unlock(vault, ctx);
		const result = await this.#bw(vault, ["list", "items", "--search", query], { BW_SESSION: key });
		if (result.exitCode !== 0) throw new VaultError(`bw list failed: ${firstLine(result)}`);
		const parsed: unknown = JSON.parse(result.stdout);
		const items = (Array.isArray(parsed) ? parsed : []).flatMap(entry => parseItem(entry) ?? []);
		if (items.length === 0) return `No entries in ${vault} match "${query}".`;
		const lines = items
			.slice(0, 25)
			.map(item => `- ${item.name} (id ${item.id}) fields: ${fieldNames(item).join(", ")}`);
		if (items.length > 25) lines.push(`${items.length - 25} more; refine the search.`);
		return lines.join("\n");
	}

	async deliver(
		vault: string,
		request: { id: string; field: string; format: FileFormat; name?: string; purpose: string },
		ctx: ExtensionContext,
	): Promise<{ path: string; label: string }> {
		const approvals = await this.#readApprovals();
		const approvalKey = `${vault}/${request.id}`;
		if (approvals[approvalKey] === "deny") throw new VaultError("This entry is denied for agents.");
		const key = await this.unlock(vault, ctx);
		const got = await this.#bw(vault, ["get", "item", request.id], { BW_SESSION: key });
		if (got.exitCode !== 0) throw new VaultError(`bw get failed: ${firstLine(got)}`);
		const item = parseItem(JSON.parse(got.stdout));
		if (!item) throw new VaultError("bw returned an entry without id or name.");
		const label = `[vault:${vault}/${item.name}/${request.field}]`;

		if (approvals[approvalKey] !== "always") {
			if (!ctx.hasUI) throw new VaultError("Approving this entry needs an interactive OMP session.");
			const choice = await ctx.ui.select?.(
				`Allow the agent to use "${item.name}" (${request.field}) from ${vault}? Purpose: ${request.purpose}`,
				[...APPROVAL_CHOICES],
			);
			if (choice === "Deny") await this.#writeApproval(approvalKey, "deny");
			if (choice === "Allow always") await this.#writeApproval(approvalKey, "always");
			if (choice !== "Allow always" && choice !== "Allow once")
				throw new VaultError("The request was denied.");
		}

		const value = await this.#fieldValue(vault, item, request.field, key);
		const content = formatValue(value, request.format, request.name);
		registerValue(value, label);

		const directory = join(this.#root, "files", vault);
		await ensurePrivateDir(directory);
		const file = join(
			directory,
			`${randomBytes(8).toString("hex")}.${request.format === "raw" ? "txt" : request.format}`,
		);
		await writePrivate(file, content);
		const expires = this.#keys.get(vault)?.expires ?? nextMidnight(this.#deps.now());
		const deliveries = await this.#readIndex(vault);
		deliveries.push({ file, label, value, expires });
		await writePrivate(join(directory, "index.json"), JSON.stringify(deliveries));
		return { path: file, label };
	}

	/** Lock the vault in bw, forget its cached key and delete its delivery files. */
	async lock(vault: string): Promise<void> {
		this.#keys.delete(vault);
		this.#synced.delete(vault);
		await this.#bw(vault, ["lock"], {}).catch(() => undefined);
		await this.#deps.keystore.remove(vault).catch(() => undefined);
		await rm(join(this.#root, "files", vault), { recursive: true, force: true });
	}

	/** Return a valid session key, asking the person to log in or unlock when needed. */
	unlock(vault: string, ctx: ExtensionContext): Promise<string> {
		if (!VAULT_NAME.test(vault))
			return Promise.reject(new VaultError("vault names are lowercase words such as scch"));
		const pending = this.#pending.get(vault);
		if (pending) return pending;
		const next = this.#unlock(vault, ctx).finally(() => this.#pending.delete(vault));
		this.#pending.set(vault, next);
		return next;
	}

	async #unlock(vault: string, ctx: ExtensionContext): Promise<string> {
		const cached = await this.#cachedKey(vault);
		if (cached && (await this.#status(vault, cached)) === "unlocked")
			return this.#afterUnlock(vault, cached, false);

		const status = await this.#status(vault);
		if (!ctx.hasUI)
			throw new VaultError(
				`The ${vault} vault is ${status}, and unlocking it needs an interactive OMP session.`,
			);
		if (status === "unauthenticated") {
			const outcome = await this.#login(vault, ctx);
			if (outcome.key) return this.#afterUnlock(vault, outcome.key, true);
			return this.#afterUnlock(
				vault,
				await this.#unlockWithPassword(vault, ctx, outcome.password),
				true,
			);
		}
		return this.#afterUnlock(vault, await this.#unlockWithPassword(vault, ctx), true);
	}

	async #afterUnlock(vault: string, key: string, fresh: boolean): Promise<string> {
		if (fresh) {
			const now = this.#deps.now();
			const entry = { key, issued: now.getTime(), expires: nextMidnight(now) };
			this.#keys.set(vault, entry);
			await this.#deps.keystore.write(vault, JSON.stringify(entry));
		}
		if (!this.#synced.has(vault)) {
			const sync = await this.#bw(vault, ["sync"], { BW_SESSION: key });
			if (sync.exitCode !== 0) throw new VaultError(`bw sync failed: ${firstLine(sync)}`);
			this.#synced.add(vault);
		}
		return key;
	}

	async #cachedKey(vault: string): Promise<string | undefined> {
		let entry = this.#keys.get(vault);
		if (!entry) {
			const stored = await this.#deps.keystore.read(vault).catch(() => undefined);
			if (!stored) return undefined;
			entry = parseCacheEntry(stored);
		}
		const now = this.#deps.now().getTime();
		if (!entry || now >= entry.expires || now < entry.issued) {
			await this.lock(vault);
			return undefined;
		}
		this.#keys.set(vault, entry);
		return entry.key;
	}

	async #status(vault: string, key?: string): Promise<"unauthenticated" | "locked" | "unlocked"> {
		const result = await this.#bw(vault, ["status"], key ? { BW_SESSION: key } : {});
		if (result.exitCode !== 0) throw new VaultError(`bw status failed: ${firstLine(result)}`);
		const parsed: unknown = JSON.parse(result.stdout);
		const status =
			parsed && typeof parsed === "object" && "status" in parsed ? parsed.status : undefined;
		if (status === "unauthenticated" || status === "locked" || status === "unlocked") return status;
		throw new VaultError(`bw reported an unknown status: ${status}`);
	}

	async #login(vault: string, ctx: ExtensionContext): Promise<{ key?: string; password: string }> {
		const server = await this.#server(vault, ctx);
		const config = await this.#bw(vault, ["config", "server", server], {});
		if (config.exitCode !== 0) throw new VaultError(`bw config server failed: ${firstLine(config)}`);
		const email = await ask(ctx, `Email for the ${vault} vault (${server})`, false);
		const password = await ask(ctx, `Master password for ${email} (${vault})`, true);

		const attempt = (extra: string[]) =>
			this.#bw(vault, ["login", email, "--passwordenv", "VAULT_MASTER_PASSWORD", "--raw", ...extra], {
				VAULT_MASTER_PASSWORD: password,
			});
		let result = await attempt([]);
		if (result.exitCode === 0) return { key: sessionKey(result), password };
		if (!needsCode(result)) throw new VaultError(`Login failed: ${firstLine(result)}`);

		const method = await ctx.ui.select?.(
			`The ${vault} vault asks for a code. Which two-step method?`,
			[...TWO_STEP_METHODS.keys(), NO_TWO_STEP],
		);
		if (method === undefined) throw new VaultError("Login cancelled.");
		if (method !== NO_TWO_STEP) {
			const methodId = TWO_STEP_METHODS.get(method);
			if (!methodId) throw new VaultError("Login cancelled.");
			// Without a code, bw asks the server to send the email and stops.
			if (methodId === "1") await attempt(["--method", methodId]);
			const code = await ask(ctx, `Two-step code for ${email} (${vault})`, true);
			result = await attempt(["--method", methodId, "--code", code]);
			if (result.exitCode === 0) return { key: sessionKey(result), password };
			if (!needsCode(result)) throw new VaultError(`Login failed: ${firstLine(result)}`);
		}

		// The remaining code is new-device verification, which bw only completes in a terminal.
		// A personal API key skips it.
		const clientId = await ask(
			ctx,
			`API key client_id for ${email} (${vault}, Settings > Security > Keys)`,
			false,
		);
		const clientSecret = await ask(ctx, `API key client_secret for ${email} (${vault})`, true);
		const apiLogin = await this.#bw(vault, ["login", "--apikey"], {
			BW_CLIENTID: clientId,
			BW_CLIENTSECRET: clientSecret,
		});
		if (apiLogin.exitCode !== 0) throw new VaultError(`API key login failed: ${firstLine(apiLogin)}`);
		return { password };
	}

	async #unlockWithPassword(vault: string, ctx: ExtensionContext, known?: string): Promise<string> {
		let password = known;
		for (let attempt = 0; attempt < 3; attempt++) {
			password ??= await ask(ctx, `Master password to unlock the ${vault} vault`, true);
			const result = await this.#bw(
				vault,
				["unlock", "--passwordenv", "VAULT_MASTER_PASSWORD", "--raw"],
				{
					VAULT_MASTER_PASSWORD: password,
				},
			);
			if (result.exitCode === 0) return sessionKey(result);
			if (!/invalid master password/iu.test(`${result.stdout}\n${result.stderr}`)) {
				throw new VaultError(`Unlock failed: ${firstLine(result)}`);
			}
			ctx.ui.notify(`Wrong master password for the ${vault} vault.`, "warning");
			password = undefined;
		}
		throw new VaultError("Unlock failed after three attempts.");
	}

	async #server(vault: string, ctx: ExtensionContext): Promise<string> {
		const file = join(this.#root, "profiles.json");
		const profiles = await readStringMap(file);
		const known = profiles[vault] ?? KNOWN_SERVERS[vault];
		if (known) return known;
		const choice = await ctx.ui.select?.(`Which server hosts the ${vault} vault?`, [
			...SERVER_CHOICES.keys(),
			CUSTOM_SERVER,
		]);
		if (choice === undefined) throw new VaultError("Login cancelled.");
		const server =
			SERVER_CHOICES.get(choice) ?? (await ask(ctx, `Server URL for the ${vault} vault`, false));
		if (!/^https:\/\/\S+$/u.test(server))
			throw new VaultError("The server URL must start with https://.");
		profiles[vault] = server;
		await ensurePrivateDir(this.#root);
		await writePrivate(file, JSON.stringify(profiles, null, "\t"));
		return server;
	}

	async #fieldValue(vault: string, item: BwItem, field: string, key: string): Promise<string> {
		const fail = () =>
			new VaultError(`"${item.name}" has no field "${field}". Fields: ${fieldNames(item).join(", ")}`);
		if (field === "totp") {
			if (!item.login?.totp) throw fail();
			const totp = await this.#bw(vault, ["get", "totp", item.id], { BW_SESSION: key });
			if (totp.exitCode !== 0) throw new VaultError(`bw get totp failed: ${firstLine(totp)}`);
			return totp.stdout.trim();
		}
		const builtin =
			field === "username"
				? item.login?.username
				: field === "password"
					? item.login?.password
					: field === "notes"
						? item.notes
						: undefined;
		if (builtin) return builtin;
		const custom =
			item.fields?.find(entry => entry.name === field) ??
			item.fields?.find(entry => entry.name?.toLowerCase() === field.toLowerCase());
		if (custom?.value) return custom.value;
		throw fail();
	}

	#bw(vault: string, args: string[], extra: Record<string, string>): Promise<CommandResult> {
		const env: Record<string, string | undefined> = {
			...process.env,
			BW_SESSION: undefined,
			BITWARDENCLI_APPDATA_DIR: join(this.#root, "bw", vault),
			BW_NOINTERACTION: "true",
			...extra,
		};
		return this.#deps.run(["bw", ...args], { env }).catch((error: unknown) => {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") {
				throw new VaultError(
					"The Bitwarden CLI (bw) is not on PATH. Install it on this machine first.",
				);
			}
			throw error;
		});
	}

	async #readApprovals(): Promise<Record<string, string>> {
		return readStringMap(join(this.#root, "approvals.json"));
	}

	async #writeApproval(key: string, decision: Approval): Promise<void> {
		const approvals = await this.#readApprovals();
		approvals[key] = decision;
		await ensurePrivateDir(this.#root);
		await writePrivate(join(this.#root, "approvals.json"), JSON.stringify(approvals, null, "\t"));
	}

	async #readIndex(vault: string): Promise<Delivery[]> {
		const parsed = await readJson(join(this.#root, "files", vault, "index.json"));
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry): entry is Delivery =>
				typeof entry?.file === "string" &&
				typeof entry.label === "string" &&
				typeof entry.value === "string" &&
				typeof entry.expires === "number",
		);
	}
}

function parseItem(raw: unknown): BwItem | undefined {
	if (!raw || typeof raw !== "object" || !("id" in raw) || !("name" in raw)) return undefined;
	if (typeof raw.id !== "string" || typeof raw.name !== "string") return undefined;
	const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);
	const login = "login" in raw && raw.login && typeof raw.login === "object" ? raw.login : undefined;
	const fields = "fields" in raw && Array.isArray(raw.fields) ? raw.fields : [];
	return {
		id: raw.id,
		name: raw.name,
		notes: "notes" in raw ? text(raw.notes) : undefined,
		login: login && {
			username: "username" in login ? text(login.username) : undefined,
			password: "password" in login ? text(login.password) : undefined,
			totp: "totp" in login ? text(login.totp) : undefined,
		},
		fields: fields.flatMap(field =>
			field && typeof field === "object" && typeof field.name === "string"
				? [{ name: field.name, value: text(field.value) }]
				: [],
		),
	};
}

function parseCacheEntry(stored: string): CacheEntry | undefined {
	try {
		const parsed: unknown = JSON.parse(stored);
		if (
			!parsed ||
			typeof parsed !== "object" ||
			!("key" in parsed) ||
			!("issued" in parsed) ||
			!("expires" in parsed)
		)
			return undefined;
		const { key, issued, expires } = parsed;
		if (typeof key !== "string" || typeof issued !== "number" || typeof expires !== "number")
			return undefined;
		return { key, issued, expires };
	} catch {
		return undefined;
	}
}

function fieldNames(item: BwItem): string[] {
	const names: string[] = [];
	if (item.login?.username) names.push("username");
	if (item.login?.password) names.push("password");
	if (item.login?.totp) names.push("totp");
	if (item.notes) names.push("notes");
	for (const field of item.fields ?? []) if (field.name) names.push(field.name);
	return names;
}

function needsCode(result: CommandResult): boolean {
	return /code is required|no provider selected/iu.test(`${result.stdout}\n${result.stderr}`);
}

function sessionKey(result: CommandResult): string {
	const key = result.stdout.trim();
	if (!/^[A-Za-z0-9+/=]{20,}$/u.test(key)) throw new VaultError("bw returned no session key.");
	return key;
}

/** First line of bw's own message. bw does not echo passwords or keys in its errors. */
function firstLine(result: CommandResult): string {
	const text = (result.stderr.trim() || result.stdout.trim()).split(/\r?\n/u)[0] ?? "";
	return redactText(text) || `exit code ${result.exitCode}`;
}

async function ask(ctx: ExtensionContext, title: string, secret: boolean): Promise<string> {
	const answer = await ctx.ui.input?.(title, undefined, { secret });
	if (!answer) throw new VaultError("Login cancelled.");
	return secret ? answer : answer.trim();
}

async function readJson(file: string): Promise<unknown> {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch {
		return undefined;
	}
}

async function readStringMap(file: string): Promise<Record<string, string>> {
	const parsed = await readJson(file);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
	return Object.fromEntries(
		Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
	);
}

async function ensurePrivateDir(directory: string): Promise<void> {
	await mkdir(directory, { recursive: true, mode: 0o700 });
}

/** Write through a temporary file and rename it, so readers never see a partial file. */
async function writePrivate(file: string, content: string): Promise<void> {
	const temporary = `${file}.${randomBytes(4).toString("hex")}.tmp`;
	await writeFile(temporary, content, { mode: 0o600 });
	await chmod(temporary, 0o600);
	await rename(temporary, file);
}

// ---------------------------------------------------------------------------
// Host boundaries
// ---------------------------------------------------------------------------

export const runProcess: ProcessRunner = async (command, options) => {
	const child = Bun.spawn(command, {
		env: Object.fromEntries(
			Object.entries(options.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
		),
		stdin: options.stdin === undefined ? "ignore" : Buffer.from(options.stdin),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return { exitCode, stdout, stderr };
};

const KEYCHAIN_SERVICE = "personal@glockyco/vault";
// .NET ProtectedData instead of the SecureString cmdlets: Windows PowerShell cannot autoload their
// module when it inherits PowerShell 7's PSModulePath.
const DPAPI_PROTECT =
	"Add-Type -AssemblyName System.Security; $b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser')))";
const DPAPI_UNPROTECT =
	"Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); [Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser')))";

/** The OS keystore: DPAPI files on Windows, the login Keychain on macOS, process memory elsewhere. */
export function createKeystore(
	platform: NodeJS.Platform,
	home: string,
	run: ProcessRunner,
): Keystore {
	const env = { ...process.env, PSModulePath: undefined };
	if (platform === "win32") {
		const file = (vault: string) => join(home, ".omp", "vault", "cache", `${vault}.dpapi`);
		const powershell = (script: string, stdin: string) =>
			run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script], { env, stdin });
		return {
			async read(vault) {
				let cipher: string;
				try {
					cipher = await readFile(file(vault), "utf8");
				} catch {
					return undefined;
				}
				const result = await powershell(DPAPI_UNPROTECT, cipher);
				return result.exitCode === 0 ? result.stdout : undefined;
			},
			async write(vault, data) {
				const result = await powershell(DPAPI_PROTECT, data);
				if (result.exitCode !== 0)
					throw new VaultError("Windows DPAPI could not protect the unlock key.");
				await ensurePrivateDir(join(home, ".omp", "vault", "cache"));
				await writePrivate(file(vault), result.stdout.trim());
			},
			async remove(vault) {
				await rm(file(vault), { force: true });
			},
		};
	}
	if (platform === "darwin") {
		return {
			async read(vault) {
				const result = await run(
					["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", vault, "-w"],
					{ env },
				);
				return result.exitCode === 0 ? result.stdout.replace(/\n$/u, "") : undefined;
			},
			async write(vault, data) {
				// security -i reads the command from stdin, so the key never appears in process arguments.
				const hex = Buffer.from(data, "utf8").toString("hex");
				const result = await run(["security", "-i"], {
					env,
					stdin: `add-generic-password -U -s "${KEYCHAIN_SERVICE}" -a ${vault} -X ${hex}\n`,
				});
				if (result.exitCode !== 0)
					throw new VaultError("The macOS Keychain could not store the unlock key.");
			},
			async remove(vault) {
				await run(["security", "delete-generic-password", "-s", KEYCHAIN_SERVICE, "-a", vault], {
					env,
				});
			},
		};
	}
	const memory = new Map<string, string>();
	return {
		read: async vault => memory.get(vault),
		write: async (vault, data) => void memory.set(vault, data),
		remove: async vault => void memory.delete(vault),
	};
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const DESCRIPTION = [
	"Use secrets from Bitwarden vaults without seeing them. Vaults: scch (SCCH Vaultwarden) and private.",
	"search lists entry names, ids and field names. file writes one field to a private file and returns its path; the person approves each entry once.",
	"Use the path, never the value: --passwordfile PATH, $(cat PATH) inside a command, curl -H @PATH for header files, a dotenv loader for dotenv files,",
	"or `await tab.fill(selector, (await Bun.file(PATH).text()))` in a JavaScript eval cell for browser logins.",
	"Never print, cat or read a delivered file into the conversation. Delivered values are redacted to [vault:...] labels in every output.",
	"Files and the unlock last until midnight. lock locks a vault early and deletes its files.",
].join(" ");

export function createVaultExtension(deps: VaultDeps): (pi: ExtensionAPI) => void {
	const service = new VaultService(deps);
	return pi => {
		const z = pi.zod;
		pi.registerTool({
			name: "vault",
			label: "Vault",
			description: DESCRIPTION,
			parameters: z.object({
				action: z.enum(["search", "file", "lock"] as const),
				vault: z.string().describe("vault name: scch or private"),
				query: z.string().optional().describe("search: words in the entry name"),
				id: z.string().optional().describe("file: entry id from search"),
				field: z
					.string()
					.optional()
					.describe("file: username, password, totp, notes or a custom field name"),
				format: z
					.enum(["raw", "dotenv", "header"] as const)
					.optional()
					.describe("file: raw value (default), NAME=value line or Name: value line"),
				name: z
					.string()
					.optional()
					.describe("file: variable or header name for dotenv and header formats"),
				purpose: z
					.string()
					.optional()
					.describe("file: what the value is for, shown to the person when approving"),
			}),
			async execute(_toolCallId, params, signal, _onUpdate, ctx) {
				if (signal?.aborted) throw new Error("vault request cancelled");
				const vault = String(params.vault ?? "");
				try {
					if (params.action === "search") {
						return text(await service.search(vault, String(params.query ?? ""), ctx));
					}
					if (params.action === "lock") {
						await service.lock(vault);
						return text(`Locked the ${vault} vault and deleted its files.`);
					}
					if (typeof params.id !== "string" || typeof params.field !== "string") {
						throw new VaultError("file needs id and field.");
					}
					const { path, label } = await service.deliver(
						vault,
						{
							id: params.id,
							field: params.field,
							format: params.format === "dotenv" || params.format === "header" ? params.format : "raw",
							name: typeof params.name === "string" ? params.name : undefined,
							purpose:
								typeof params.purpose === "string" && params.purpose ? params.purpose : "not stated",
						},
						ctx,
					);
					return text(`${label} is in ${path}\nUse the path. Do not print the file.`);
				} catch (error) {
					if (error instanceof VaultError) throw new Error(error.message);
					throw new Error(
						`vault failed: ${redactText(error instanceof Error ? error.message : String(error))}`,
					);
				}
			},
		});

		pi.on("session_start", async () => {
			await service.reload();
		});
		pi.on("tool_call", event => {
			if (containsValue(JSON.stringify(event.input))) {
				return {
					block: true,
					reason: "The call contains a vault value. Pass the delivered file path instead.",
				};
			}
		});
		pi.on("tool_result", event => {
			const content = redactDeep(event.content);
			const details = redactDeep(event.details);
			if (content === event.content && details === event.details) return;
			return { content, details };
		});
		pi.on("context", event => {
			const messages = redactDeep(event.messages);
			if (messages !== event.messages) return { messages };
		});
		pi.on("before_provider_request", event => {
			const payload = redactDeep(event.payload);
			if (payload !== event.payload) return payload;
		});
	};
}

function text(value: string): { content: Array<{ type: "text"; text: string }> } {
	return { content: [{ type: "text", text: value }] };
}

export default function vault(pi: ExtensionAPI): void {
	const home = homedir();
	createVaultExtension({
		home,
		run: runProcess,
		keystore: createKeystore(process.platform, home, runProcess),
		now: () => new Date(),
	})(pi);
}
