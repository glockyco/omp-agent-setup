import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const OMP_ASSETS = [
	"omp-darwin-arm64",
	"omp-darwin-x64",
	"omp-linux-arm64",
	"omp-linux-x64",
	"omp-windows-arm64.exe",
	"omp-windows-x64.exe",
] as const;

export type OmpAsset = (typeof OMP_ASSETS)[number];

export interface OmpPin {
	tag: string;
	assets: Record<OmpAsset, string>;
}

export const OMP_PIN_PATH = resolve(import.meta.dir, "..", ".omp-version");

export function validateTag(tag: unknown): string {
	if (typeof tag !== "string" || /^v\d+\.\d+\.\d+$/.exec(tag)?.[0] !== tag)
		throw new Error("invalid OMP release tag: expected an explicit vX.Y.Z tag");
	return tag;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePin(data: unknown): OmpPin {
	if (!isObject(data)) throw new Error("invalid OMP pin: expected an object");
	const tag = validateTag(data.tag);
	if (!isObject(data.assets)) throw new Error("invalid OMP pin: assets must be an object");
	const assets = data.assets;
	const keys = Object.keys(assets);
	for (const key of keys) {
		if (!OMP_ASSETS.some(asset => asset === key))
			throw new Error(`invalid OMP pin: unexpected asset ${key}`);
	}
	for (const asset of OMP_ASSETS) {
		if (!Object.hasOwn(assets, asset)) throw new Error(`invalid OMP pin: missing asset ${asset}`);
		const digest = assets[asset];
		if (typeof digest !== "string" || digest.length !== 71 || !/^sha256:[a-f0-9]{64}$/.test(digest))
			throw new Error(`invalid OMP pin: invalid SHA-256 digest for ${asset}`);
	}
	return {
		tag,
		assets: Object.fromEntries(OMP_ASSETS.map(asset => [asset, assets[asset]])) as Record<
			OmpAsset,
			string
		>,
	};
}

export async function readPin(): Promise<OmpPin> {
	return validatePin(JSON.parse(await readFile(OMP_PIN_PATH, "utf8")));
}

export function pinFromSums(tag: string, text: string): OmpPin {
	const validatedTag = validateTag(tag);
	const assets: Partial<Record<OmpAsset, string>> = {};
	for (const line of text.split(/\r?\n/)) {
		const tokens = line.trim().split(/\s+/);
		const required = OMP_ASSETS.find(asset =>
			tokens.some(token => token === asset || token === `*${asset}`),
		);
		if (!required) continue;
		const match = /^([a-fA-F0-9]{64})[ \t]+\*?(\S+)[ \t]*$/.exec(line);
		if (!match || match[2] !== required || !match[1])
			throw new Error(`invalid SHA256SUMS.txt: malformed checksum for ${required}`);
		if (Object.hasOwn(assets, required))
			throw new Error(`invalid SHA256SUMS.txt: duplicate asset ${required}`);
		assets[required] = `sha256:${match[1].toLowerCase()}`;
	}
	return validatePin({ tag: validatedTag, assets });
}
