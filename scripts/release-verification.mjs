import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

import { assertReleaseVersion } from "./release-version.mjs";

export const RELEASE_REPOSITORY = "choral-io/choral-forma";

const ARCHIVE_ASSETS = [
    "forma-linux-arm64.tar.gz",
    "forma-linux-x64.tar.gz",
    "forma-macos-arm64.tar.gz",
    "forma-macos-x64.tar.gz",
    "forma-windows-x64.zip",
];

const MANAGED_ASSETS = [
    "forma-linux-arm64",
    "forma-linux-x64",
    "forma-macos-arm64",
    "forma-macos-x64",
    "forma-windows-x64.exe",
];

export function releaseVersionFromTag(tag) {
    if (typeof tag !== "string" || !tag.startsWith("v")) {
        throw new Error("Release verification requires a v-prefixed tag, for example v0.1.0-alpha.18.");
    }
    return assertReleaseVersion(tag.slice(1));
}

export function expectedReleaseAssetNames(version) {
    const normalized = assertReleaseVersion(version);
    const payloads = [...ARCHIVE_ASSETS, ...MANAGED_ASSETS, `forma-${normalized}.vsix`];
    return payloads.flatMap((name) => [name, `${name}.sha256`]).sort();
}

export function validateReleaseMetadata(
    release,
    tag,
    expectedNames = expectedReleaseAssetNames(releaseVersionFromTag(tag)),
) {
    if (!release || typeof release !== "object") throw new Error("GitHub returned invalid release metadata.");
    if (release.tag_name !== tag) {
        throw new Error(`Release tag mismatch: expected ${tag}, received ${String(release.tag_name)}.`);
    }
    if (release.draft !== false) throw new Error(`Release ${tag} is still a draft.`);

    const version = releaseVersionFromTag(tag);
    const expectedPrerelease = version.includes("-");
    if (release.prerelease !== expectedPrerelease) {
        throw new Error(
            `Release prerelease flag mismatch for ${tag}: expected ${String(expectedPrerelease)}, received ${String(release.prerelease)}.`,
        );
    }
    if (!Array.isArray(release.assets)) throw new Error(`Release ${tag} has no asset list.`);

    const assets = new Map();
    for (const asset of release.assets) {
        if (!asset || typeof asset !== "object" || typeof asset.name !== "string") {
            throw new Error(`Release ${tag} contains invalid asset metadata.`);
        }
        if (assets.has(asset.name)) throw new Error(`Release ${tag} contains duplicate asset ${asset.name}.`);
        if (asset.state !== "uploaded") throw new Error(`Release asset ${asset.name} is not uploaded.`);
        if (typeof asset.browser_download_url !== "string" || asset.browser_download_url.length === 0) {
            throw new Error(`Release asset ${asset.name} has no download URL.`);
        }
        assets.set(asset.name, asset);
    }

    const expected = new Set(expectedNames);
    const missing = [...expected].filter((name) => !assets.has(name)).sort();
    const unexpected = [...assets.keys()].filter((name) => !expected.has(name)).sort();
    if (missing.length > 0 || unexpected.length > 0) {
        throw new Error(
            [
                `Release ${tag} asset inventory does not match.`,
                missing.length > 0 ? `Missing: ${missing.join(", ")}.` : "",
                unexpected.length > 0 ? `Unexpected: ${unexpected.join(", ")}.` : "",
            ]
                .filter(Boolean)
                .join(" "),
        );
    }
    return assets;
}

export function parsePublishedChecksum(source, expectedName) {
    const lines = source
        .trim()
        .split(/\r?\n/u)
        .filter((line) => line.length > 0);
    if (lines.length !== 1) throw new Error(`Checksum for ${expectedName} must contain exactly one entry.`);
    const match = /^([a-fA-F0-9]{64})\s+\*?(.+)$/u.exec(lines[0]);
    if (!match) throw new Error(`Checksum for ${expectedName} is invalid.`);
    if (match[2] !== expectedName) {
        throw new Error(`Checksum names ${match[2]} instead of ${expectedName}.`);
    }
    return match[1].toLowerCase();
}

export async function sha256File(path) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest("hex");
}
