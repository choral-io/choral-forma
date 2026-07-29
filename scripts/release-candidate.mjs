import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { expectedReleaseAssetNames, parsePublishedChecksum, sha256File } from "./release-verification.mjs";
import { assertReleaseVersion } from "./release-version.mjs";

const SOURCE_SHA_PATTERN = /^[a-fA-F0-9]{40}$/u;
const MANIFEST_SCHEMA_VERSION = 1;
const MANIFEST_OPERATION = "release-candidate";
const MANIFEST_STATUS = "assembled";

export function assertSourceSha(sourceSha) {
    if (typeof sourceSha !== "string" || !SOURCE_SHA_PATTERN.test(sourceSha)) {
        throw new Error("Release candidate source SHA must be exactly 40 hexadecimal characters.");
    }
    return sourceSha.toLowerCase();
}

export async function assembleReleaseCandidate({ assetsDirectory, sourceSha, version }) {
    const normalizedVersion = assertReleaseVersion(version);
    const normalizedSourceSha = assertSourceSha(sourceSha);
    const expectedNames = expectedReleaseAssetNames(normalizedVersion);
    await assertExactAssetInventory(assetsDirectory, expectedNames);

    const assets = [];
    for (const name of expectedNames) {
        const file = path.join(assetsDirectory, name);
        const details = await stat(file);
        assets.push({
            name,
            size: details.size,
            sha256: await sha256File(file),
        });
    }
    await assertPayloadChecksums(assetsDirectory, assets);

    return {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        operation: MANIFEST_OPERATION,
        status: MANIFEST_STATUS,
        version: normalizedVersion,
        tag: `v${normalizedVersion}`,
        sourceSha: normalizedSourceSha,
        assets,
    };
}

export async function verifyReleaseCandidate({ assetsDirectory, manifest, sourceSha }) {
    const result = await verifyReleaseCandidateSubset({ assetsDirectory, manifest, sourceSha });
    if (result.missingNames.length > 0) {
        throw new Error(`Release candidate asset inventory is incomplete. Missing: ${result.missingNames.join(", ")}.`);
    }
    const expected = await assembleReleaseCandidate({
        assetsDirectory,
        sourceSha: manifest.sourceSha,
        version: manifest.version,
    });
    if (JSON.stringify(manifest) !== JSON.stringify(expected)) {
        throw new Error("Release candidate manifest does not match the verified asset directory.");
    }
    return expected;
}

export async function verifyReleaseCandidateSubset({ assetsDirectory, manifest, sourceSha }) {
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
        throw new Error("Release candidate manifest must be a JSON object.");
    }
    const expectedSourceSha = assertSourceSha(sourceSha);
    if (manifest.sourceSha !== expectedSourceSha) {
        throw new Error(
            `Release candidate source SHA mismatch: expected ${expectedSourceSha}, received ${String(manifest.sourceSha)}.`,
        );
    }
    const version = assertReleaseVersion(manifest.version);
    const expectedNames = expectedReleaseAssetNames(version);
    if (
        manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
        manifest.operation !== MANIFEST_OPERATION ||
        manifest.status !== MANIFEST_STATUS ||
        manifest.tag !== `v${version}` ||
        !Array.isArray(manifest.assets)
    ) {
        throw new Error("Release candidate manifest metadata is invalid.");
    }
    const expectedByName = new Map();
    for (const asset of manifest.assets) {
        if (
            !asset ||
            typeof asset !== "object" ||
            typeof asset.name !== "string" ||
            !Number.isSafeInteger(asset.size) ||
            asset.size < 0 ||
            typeof asset.sha256 !== "string" ||
            !/^[a-f0-9]{64}$/u.test(asset.sha256) ||
            expectedByName.has(asset.name)
        ) {
            throw new Error("Release candidate manifest contains invalid or duplicate asset metadata.");
        }
        expectedByName.set(asset.name, asset);
    }
    if (
        manifest.assets.map(({ name }) => name).join("\n") !== expectedNames.join("\n") ||
        expectedNames.some((name) => !expectedByName.has(name))
    ) {
        throw new Error("Release candidate manifest asset inventory does not match the required 22 files.");
    }

    let entries;
    try {
        entries = await readdir(assetsDirectory, { withFileTypes: true });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Unable to read release candidate asset directory ${assetsDirectory}: ${detail}`);
    }
    const presentNames = entries.map(({ name }) => name).sort();
    for (const entry of entries) {
        const expected = expectedByName.get(entry.name);
        if (!expected) throw new Error(`Release candidate contains unexpected asset ${entry.name}.`);
        if (!entry.isFile()) throw new Error(`Release candidate asset ${entry.name} must be a regular file.`);
        const file = path.join(assetsDirectory, entry.name);
        const details = await stat(file);
        const digest = await sha256File(file);
        if (details.size !== expected.size || digest !== expected.sha256) {
            throw new Error(`Release candidate asset ${entry.name} does not match its manifest size and digest.`);
        }
    }
    const present = new Set(presentNames);
    return {
        presentNames,
        missingNames: expectedNames.filter((name) => !present.has(name)),
    };
}

async function assertExactAssetInventory(assetsDirectory, expectedNames) {
    let entries;
    try {
        entries = await readdir(assetsDirectory, { withFileTypes: true });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Unable to read release candidate asset directory ${assetsDirectory}: ${detail}`);
    }
    const actualNames = entries.map((entry) => entry.name).sort();
    const expected = new Set(expectedNames);
    const actual = new Set(actualNames);
    const missing = expectedNames.filter((name) => !actual.has(name));
    const unexpected = actualNames.filter((name) => !expected.has(name));
    if (missing.length > 0 || unexpected.length > 0) {
        throw new Error(
            [
                "Release candidate asset inventory does not match the required 22 files.",
                missing.length > 0 ? `Missing: ${missing.join(", ")}.` : "",
                unexpected.length > 0 ? `Unexpected: ${unexpected.join(", ")}.` : "",
            ]
                .filter(Boolean)
                .join(" "),
        );
    }
    for (const entry of entries) {
        if (!entry.isFile()) {
            throw new Error(`Release candidate asset ${entry.name} must be a regular file.`);
        }
    }
}

async function assertPayloadChecksums(assetsDirectory, assets) {
    const digests = new Map(assets.map((asset) => [asset.name, asset.sha256]));
    for (const asset of assets) {
        if (asset.name.endsWith(".sha256")) continue;
        const checksumName = `${asset.name}.sha256`;
        const source = await readFile(path.join(assetsDirectory, checksumName), "utf8");
        const expectedDigest = parsePublishedChecksum(source, asset.name);
        if (expectedDigest !== digests.get(asset.name)) {
            throw new Error(
                `Checksum digest mismatch for ${asset.name}: expected ${digests.get(asset.name)}, received ${expectedDigest}.`,
            );
        }
    }
}

function readOption(argumentsList, name, { required = false } = {}) {
    const index = argumentsList.indexOf(name);
    if (index === -1) {
        if (required) throw new Error(`Missing required ${name} option.`);
        return undefined;
    }
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Option ${name} requires a value.`);
    return value;
}

async function main(argumentsList) {
    const [command, ...options] = argumentsList;
    if (command === "assemble") {
        const manifest = await assembleReleaseCandidate({
            assetsDirectory: readOption(options, "--assets-dir", { required: true }),
            sourceSha: readOption(options, "--source-sha", { required: true }),
            version: readOption(options, "--version", { required: true }),
        });
        const output = readOption(options, "--output", { required: true });
        await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
        return;
    }
    if (command === "verify") {
        const manifestPath = readOption(options, "--manifest", { required: true });
        let manifest;
        try {
            manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`Unable to read release candidate manifest ${manifestPath}: ${detail}`);
        }
        const verified = await verifyReleaseCandidate({
            assetsDirectory: readOption(options, "--assets-dir", { required: true }),
            manifest,
            sourceSha: readOption(options, "--source-sha", { required: true }),
        });
        process.stdout.write(`Verified release candidate ${verified.tag} for ${verified.sourceSha}.\n`);
        return;
    }
    if (command === "verify-subset") {
        const manifestPath = readOption(options, "--manifest", { required: true });
        let manifest;
        try {
            manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`Unable to read release candidate manifest ${manifestPath}: ${detail}`);
        }
        const result = await verifyReleaseCandidateSubset({
            assetsDirectory: readOption(options, "--assets-dir", { required: true }),
            manifest,
            sourceSha: readOption(options, "--source-sha", { required: true }),
        });
        process.stdout.write(`${JSON.stringify(result)}\n`);
        return;
    }
    throw new Error("Usage: release-candidate.mjs <assemble|verify|verify-subset> --assets-dir <directory> [options].");
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
    main(process.argv.slice(2)).catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
