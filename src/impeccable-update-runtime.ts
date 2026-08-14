import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, posix, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { type UpdateImpeccableResult, updateImpeccableFromBundle } from "./impeccable-update.ts";

const IMPECCABLE_BUNDLE_URL = "https://impeccable.style/api/download/bundle/universal";
const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_DIRECTORY = 0o040000;
const UNIX_REGULAR_FILE = 0o100000;
const UNIX_SYMBOLIC_LINK = 0o120000;

export interface UpdateImpeccableRemoteOptions {
	repoRoot: string;
	bundleUrl?: string;
}

function openZip(path: string): Promise<ZipFile> {
	const { promise, reject, resolve } = Promise.withResolvers<ZipFile>();
	yauzl.open(
		path,
		{
			autoClose: true,
			decodeStrings: true,
			lazyEntries: true,
			strictFileNames: true,
			validateEntrySizes: true,
		},
		(error, zipFile) => {
			if (error) {
				reject(error);
				return;
			}
			resolve(zipFile);
		},
	);
	return promise;
}

function openEntryStream(zipFile: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
	const { promise, reject, resolve } = Promise.withResolvers<NodeJS.ReadableStream>();
	zipFile.openReadStream(entry, (error, stream) => {
		if (error) {
			reject(error);
			return;
		}
		resolve(stream);
	});
	return promise;
}

function entryUnixType(entry: Entry): number | undefined {
	const madeByUnix = entry.versionMadeBy >>> 8 === 3;
	if (!madeByUnix) return undefined;
	return (entry.externalFileAttributes >>> 16) & UNIX_FILE_TYPE_MASK;
}

function resolveArchiveEntry(
	destination: string,
	entry: Entry,
): {
	path: string;
	isDirectory: boolean;
} {
	const validationError = yauzl.validateFileName(entry.fileName);
	if (validationError) {
		throw new Error(`Unsafe archive entry ${JSON.stringify(entry.fileName)}: ${validationError}`);
	}

	const normalized = posix.normalize(entry.fileName);
	if (
		normalized === "." ||
		normalized === ".." ||
		normalized.startsWith("../") ||
		posix.isAbsolute(normalized)
	) {
		throw new Error(`Unsafe archive entry path: ${JSON.stringify(entry.fileName)}`);
	}

	const unixType = entryUnixType(entry);
	if (unixType === UNIX_SYMBOLIC_LINK) {
		throw new Error(`Archive entry is a symbolic link: ${JSON.stringify(entry.fileName)}`);
	}
	if (
		unixType !== undefined &&
		unixType !== 0 &&
		unixType !== UNIX_DIRECTORY &&
		unixType !== UNIX_REGULAR_FILE
	) {
		throw new Error(`Archive entry has unsupported file type: ${JSON.stringify(entry.fileName)}`);
	}

	const destinationRoot = resolve(destination);
	const target = resolve(destinationRoot, ...normalized.split("/"));
	const fromDestination = relative(destinationRoot, target);
	if (fromDestination === ".." || fromDestination.startsWith(`..${posix.sep}`)) {
		throw new Error(`Archive entry escapes destination: ${JSON.stringify(entry.fileName)}`);
	}

	return {
		path: target,
		isDirectory: entry.fileName.endsWith("/") || unixType === UNIX_DIRECTORY,
	};
}

export async function extractZipSecure(zipPath: string, destination: string): Promise<void> {
	const zipFile = await openZip(zipPath);
	const { promise, reject, resolve: resolveExtraction } = Promise.withResolvers<void>();
	let settled = false;
	const fail = (error: unknown) => {
		if (settled) return;
		settled = true;
		zipFile.close();
		reject(error);
	};

	zipFile.once("error", fail);
	zipFile.once("end", () => {
		if (settled) return;
		settled = true;
		resolveExtraction();
	});
	zipFile.on("entry", (entry: Entry) => {
		void (async () => {
			const target = resolveArchiveEntry(destination, entry);
			if (target.isDirectory) {
				await mkdir(target.path, { recursive: true });
			} else {
				await mkdir(dirname(target.path), { recursive: true });
				const stream = await openEntryStream(zipFile, entry);
				await pipeline(stream, createWriteStream(target.path, { flags: "wx", mode: 0o600 }));
			}
			zipFile.readEntry();
		})().catch(fail);
	});
	zipFile.readEntry();
	await promise;
}

export async function updateImpeccableFromRemote(
	options: UpdateImpeccableRemoteOptions,
): Promise<UpdateImpeccableResult> {
	const workspace = await mkdtemp(join(tmpdir(), "omp-impeccable-update-"));
	try {
		const zipPath = join(workspace, "impeccable.zip");
		const bundleRoot = join(workspace, "bundle");
		await mkdir(bundleRoot, { recursive: true });
		const response = await fetch(options.bundleUrl ?? IMPECCABLE_BUNDLE_URL);
		if (!response.ok) {
			throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
		}
		await Bun.write(zipPath, await response.arrayBuffer());
		await extractZipSecure(zipPath, bundleRoot);
		return await updateImpeccableFromBundle({ repoRoot: options.repoRoot, bundleRoot });
	} finally {
		await rm(workspace, { recursive: true, force: true });
	}
}
