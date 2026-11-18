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

/** The shortest time any single download gets, however small the asset. */
export const MIN_DOWNLOAD_TIMEOUT_MS = 120_000;
/** Fixed allowance for connection setup and redirects before bytes arrive. */
const DOWNLOAD_OVERHEAD_MS = 60_000;
/** The slowest sustained throughput a verification run is expected to tolerate. */
export const DEFAULT_MIN_DOWNLOAD_BYTES_PER_SECOND = 128 * 1024;

/**
 * How long to allow for downloading an asset of the published size. Large binaries on a slow
 * connection need longer than a fixed limit, so the deadline grows with the asset at a minimum
 * throughput, which `FORMA_RELEASE_MIN_DOWNLOAD_BYTES_PER_SECOND` can lower for slower networks.
 */
export function downloadTimeoutMs(size, environment = process.env) {
    const configured = Number(environment.FORMA_RELEASE_MIN_DOWNLOAD_BYTES_PER_SECOND);
    const bytesPerSecond =
        Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MIN_DOWNLOAD_BYTES_PER_SECOND;
    const bytes = Number.isFinite(size) && size > 0 ? size : 0;
    return Math.max(MIN_DOWNLOAD_TIMEOUT_MS, DOWNLOAD_OVERHEAD_MS + Math.ceil((bytes / bytesPerSecond) * 1000));
}

/** How long a download may go without receiving any data before it is treated as stalled. */
export const DEFAULT_DOWNLOAD_IDLE_TIMEOUT_MS = 30_000;

/** The idle limit, which `FORMA_RELEASE_DOWNLOAD_IDLE_TIMEOUT_MS` can raise or lower. */
export function downloadIdleTimeoutMs(environment = process.env) {
    const configured = Number(environment.FORMA_RELEASE_DOWNLOAD_IDLE_TIMEOUT_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DOWNLOAD_IDLE_TIMEOUT_MS;
}

/**
 * Wraps a fetch so that a download fails once no data has arrived for `idleMs`: while waiting for
 * the response, and while waiting for each chunk of its body. A slow download that keeps
 * delivering data continues until its overall deadline; a stalled one fails early. The wrapper
 * races each read itself, so it does not depend on the underlying fetch honoring an abort.
 */
export function withIdleTimeout(fetchImplementation, idleMs) {
    return async (input, init = {}) => {
        const idle = new AbortController();
        const signal = init.signal ? AbortSignal.any([init.signal, idle.signal]) : idle.signal;
        let timer;
        const stop = () => clearTimeout(timer);
        const arm = () => {
            stop();
            timer = setTimeout(
                () => idle.abort(new Error(`Download stalled: no data for ${String(idleMs)} ms from ${input}`)),
                idleMs,
            );
        };
        const stalled = new Promise((_, reject) => {
            const fail = () => reject(signal.reason);
            if (signal.aborted) fail();
            else signal.addEventListener("abort", fail, { once: true });
        });
        stalled.catch(() => undefined);

        arm();
        let response;
        try {
            response = await Promise.race([fetchImplementation(input, { ...init, signal }), stalled]);
        } catch (error) {
            stop();
            throw error;
        }
        if (!response.body) {
            stop();
            return response;
        }
        const reader = response.body.getReader();
        const body = new ReadableStream({
            async pull(controller) {
                arm();
                let chunk;
                try {
                    chunk = await Promise.race([reader.read(), stalled]);
                } catch (error) {
                    stop();
                    await reader.cancel(error).catch(() => undefined);
                    throw error;
                }
                // Time spent writing a chunk is not time spent waiting for the network.
                stop();
                if (chunk.done) controller.close();
                else controller.enqueue(chunk.value);
            },
            async cancel(reason) {
                stop();
                await reader.cancel(reason);
            },
        });
        return {
            body,
            headers: response.headers,
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
        };
    };
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
