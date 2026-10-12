import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
	OMP_ASSETS,
	OMP_PIN_PATH,
	type OmpPin,
	pinFromSums,
	readPin,
	validatePin,
	validateTag,
} from "../scripts/omp-pin";

const reviewed: OmpPin = {
	tag: "v18.8.7",
	assets: {
		"omp-darwin-arm64": "sha256:cf0227bdefca0c486bd2aed1771de3ab98930266883eb69d341caf5665caee14",
		"omp-darwin-x64": "sha256:8c78893d62f4a431006706697df132a0b54ce0ca45e4d61e8995a14c7ad53b05",
		"omp-linux-arm64": "sha256:c8542530ed7cb54ce0edd6ac2cbbdab892e8b74cd740074686dc6d2c5786b0fc",
		"omp-linux-x64": "sha256:b87f9835a0acdbb81bbbad8273aa2d999b608a208598421a9584cffeb3139a8a",
		"omp-windows-arm64.exe":
			"sha256:00fac24510e7c737a42c4614f9c95c5e5426653ef4f22843c7d1d83faf709f4a",
		"omp-windows-x64.exe": "sha256:3fee68733791b3d0b2816e8c7b5987813afd103762f8cfd7239d57ed213286dc",
	},
};
const sums = OMP_ASSETS.map(asset => `${reviewed.assets[asset].slice(7)}  ${asset}`).join("\n");

test("canonical native pin path reads the reviewed tag and every official asset digest", async () => {
	expect(OMP_ASSETS).toEqual([
		"omp-darwin-arm64",
		"omp-darwin-x64",
		"omp-linux-arm64",
		"omp-linux-x64",
		"omp-windows-arm64.exe",
		"omp-windows-x64.exe",
	]);
	expect(isAbsolute(OMP_PIN_PATH)).toBe(true);
	expect(OMP_PIN_PATH).toBe(resolve(import.meta.dir, "..", ".omp-version"));
	const pin = JSON.parse(await readFile(OMP_PIN_PATH, "utf8"));
	expect(await readPin()).toEqual(validatePin(pin));
});

test("pin validation preserves all six reviewed digests", () => {
	expect(validatePin(reviewed)).toEqual(reviewed);
});

test.each([null, undefined, [], "v18.8.7", 42, true].map(root => ({ root })))(
	"pin validation rejects malformed root %j",
	({ root }) => {
		expect(() => validatePin(root)).toThrow("expected an object");
	},
);

test.each([null, undefined, [], "digests", 42].map(assets => ({ assets })))(
	"pin validation rejects malformed assets %j",
	({ assets }) => {
		expect(() => validatePin({ tag: reviewed.tag, assets })).toThrow("assets must be an object");
	},
);

test.each([
	undefined,
	null,
	18,
	"latest",
	"18.8.7",
	"v18.8",
	"v18.8.7-beta.1",
	"v18.8.7+build",
	" v18.8.7",
	"v18.8.7\n",
	"v18.8.7/../../other",
])("all pin entry points reject non-explicit tag %j", tag => {
	expect(() => validateTag(tag)).toThrow("explicit vX.Y.Z");
	expect(() => validatePin({ ...reviewed, tag })).toThrow("explicit vX.Y.Z");
	if (typeof tag === "string") expect(() => pinFromSums(tag, sums)).toThrow("explicit vX.Y.Z");
});

test("explicit semantic release tags are accepted without selecting a fallback", () => {
	expect(validateTag("v19.0.0")).toBe("v19.0.0");
	expect(pinFromSums("v19.0.0", sums)).toEqual({ ...reviewed, tag: "v19.0.0" });
});

test.each([...OMP_ASSETS])("pin validation rejects missing asset %s", asset => {
	const assets: Partial<OmpPin["assets"]> = { ...reviewed.assets };
	delete assets[asset];
	expect(() => validatePin({ ...reviewed, assets })).toThrow(`missing asset ${asset}`);
});

test("pin validation rejects extra assets", () => {
	expect(() =>
		validatePin({
			...reviewed,
			assets: { ...reviewed.assets, "omp-linux-riscv64": `sha256:${"a".repeat(64)}` },
		}),
	).toThrow("unexpected asset omp-linux-riscv64");
});

test.each([
	undefined,
	null,
	42,
	"a".repeat(64),
	`sha512:${"a".repeat(64)}`,
	`sha256:${"a".repeat(63)}`,
	`sha256:${"a".repeat(65)}`,
	`sha256:${"A".repeat(64)}`,
	`sha256:${"g".repeat(64)}`,
	`sha256:${"a".repeat(64)}\n`,
])("pin validation rejects malformed digest %j", digest => {
	for (const asset of OMP_ASSETS) {
		expect(() =>
			validatePin({ ...reviewed, assets: { ...reviewed.assets, [asset]: digest } }),
		).toThrow(`invalid SHA-256 digest for ${asset}`);
	}
});

test("checksum parser accepts six official rows", () => {
	expect(pinFromSums(reviewed.tag, sums)).toEqual(reviewed);
});

test("checksum parser accepts binary markers, uppercase hex, CRLF and any asset order", () => {
	const text = [...OMP_ASSETS]
		.reverse()
		.map(asset => `${reviewed.assets[asset].slice(7).toUpperCase()} *${asset}`)
		.join("\r\n");
	expect(pinFromSums(reviewed.tag, `${text}\r\n`)).toEqual(reviewed);
});

test("checksum parser ignores unrelated official asset rows and blank lines", () => {
	const text = `${"a".repeat(64)}  omp-linux-x64.tar.gz\n\n${sums}\n${"b".repeat(64)} *omp-source.tar.gz\n`;
	expect(pinFromSums(reviewed.tag, text)).toEqual(reviewed);
});

test.each([...OMP_ASSETS])("checksum parser rejects missing required asset %s", asset => {
	const text = OMP_ASSETS.filter(candidate => candidate !== asset)
		.map(candidate => `${reviewed.assets[candidate].slice(7)}  ${candidate}`)
		.join("\n");
	expect(() => pinFromSums(reviewed.tag, text)).toThrow(`missing asset ${asset}`);
});

test.each([...OMP_ASSETS])("checksum parser rejects duplicate required asset %s", asset => {
	const duplicate = `${reviewed.assets[asset].slice(7)} *${asset}`;
	expect(() => pinFromSums(reviewed.tag, `${sums}\n${duplicate}`)).toThrow(
		`duplicate asset ${asset}`,
	);
});

test.each([
	"not-a-checksum  ASSET",
	`${"a".repeat(63)}  ASSET`,
	`${"a".repeat(65)}  ASSET`,
	`${"g".repeat(64)} *ASSET`,
	`sha256:${"a".repeat(64)}  ASSET`,
	"ASSET",
	`${"a".repeat(64)}  ASSET trailing-token`,
])("checksum parser rejects malformed required row %s", row => {
	for (const asset of OMP_ASSETS) {
		const text = sums.replace(
			`${reviewed.assets[asset].slice(7)}  ${asset}`,
			row.replace("ASSET", asset),
		);
		expect(() => pinFromSums(reviewed.tag, text)).toThrow(`malformed checksum for ${asset}`);
	}
});

test("checksum parser rejects empty sums instead of selecting a fallback", () => {
	expect(() => pinFromSums(reviewed.tag, "")).toThrow("missing asset omp-darwin-arm64");
});
