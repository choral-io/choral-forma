import assert from "node:assert/strict";
import test from "node:test";

import {
    DEFAULT_DOWNLOAD_IDLE_TIMEOUT_MS,
    DEFAULT_MIN_DOWNLOAD_BYTES_PER_SECOND,
    downloadIdleTimeoutMs,
    downloadTimeoutMs,
    expectedReleaseAssetNames,
    MIN_DOWNLOAD_TIMEOUT_MS,
    parsePublishedChecksum,
    releaseVersionFromTag,
    validateReleaseMetadata,
    withIdleTimeout,
} from "./release-verification.mjs";

const VERSION = "0.1.0-alpha.18";
const TAG = `v${VERSION}`;

test("derives the exact 22 release assets", () => {
    const names = expectedReleaseAssetNames(VERSION);
    assert.equal(names.length, 22);
    assert.equal(new Set(names).size, names.length);
    assert.ok(names.includes(`forma-${VERSION}.vsix`));
    assert.ok(names.includes(`forma-${VERSION}.vsix.sha256`));
    assert.ok(names.includes("forma-macos-arm64"));
    assert.ok(names.includes("forma-windows-x64.zip.sha256"));
});

test("accepts only v-prefixed release tags", () => {
    assert.equal(releaseVersionFromTag(TAG), VERSION);
    assert.throws(() => releaseVersionFromTag(VERSION), /v-prefixed tag/u);
});

test("validates an uploaded prerelease with the exact asset inventory", () => {
    const release = releaseFixture();
    const assets = validateReleaseMetadata(release, TAG);
    assert.equal(assets.size, 22);
    assert.equal(assets.get(`forma-${VERSION}.vsix`).state, "uploaded");
});

test("rejects draft, incomplete, and unexpected release inventories", () => {
    assert.throws(() => validateReleaseMetadata({ ...releaseFixture(), draft: true }, TAG), /still a draft/u);

    const missing = releaseFixture();
    missing.assets.pop();
    assert.throws(() => validateReleaseMetadata(missing, TAG), /Missing:/u);

    const unexpected = releaseFixture();
    unexpected.assets.push(assetFixture("extra-file"));
    assert.throws(() => validateReleaseMetadata(unexpected, TAG), /Unexpected:/u);
});

test("parses an asset-specific SHA-256 entry", () => {
    const digest = "a".repeat(64);
    assert.equal(parsePublishedChecksum(`${digest}  forma-macos-arm64\n`, "forma-macos-arm64"), digest);
    assert.throws(() => parsePublishedChecksum(`${digest}  forma-macos-x64\n`, "forma-macos-arm64"), /instead of/u);
    assert.throws(() => parsePublishedChecksum("invalid", "forma-macos-arm64"), /invalid/u);
});

function releaseFixture() {
    return {
        tag_name: TAG,
        draft: false,
        prerelease: true,
        html_url: `https://github.com/choral-io/choral-forma/releases/tag/${TAG}`,
        assets: expectedReleaseAssetNames(VERSION).map(assetFixture),
    };
}

function assetFixture(name) {
    return {
        name,
        state: "uploaded",
        browser_download_url: `https://example.test/${encodeURIComponent(name)}`,
    };
}

test("scales the download deadline with the published asset size", () => {
    // Checksums and the VSIX keep the floor; a 35 MB binary gets time at the minimum throughput.
    assert.equal(downloadTimeoutMs(87, {}), MIN_DOWNLOAD_TIMEOUT_MS);
    assert.equal(downloadTimeoutMs(392_365, {}), MIN_DOWNLOAD_TIMEOUT_MS);
    const binary = 34_599_320;
    assert.equal(
        downloadTimeoutMs(binary, {}),
        60_000 + Math.ceil((binary / DEFAULT_MIN_DOWNLOAD_BYTES_PER_SECOND) * 1000),
    );
    assert(downloadTimeoutMs(binary, {}) > 300_000);
    // A slower network can lower the expected throughput; invalid values fall back to the default.
    assert.equal(
        downloadTimeoutMs(binary, { FORMA_RELEASE_MIN_DOWNLOAD_BYTES_PER_SECOND: "65536" }),
        60_000 + Math.ceil((binary / 65_536) * 1000),
    );
    for (const value of ["0", "-1", "fast", ""]) {
        assert.equal(
            downloadTimeoutMs(binary, { FORMA_RELEASE_MIN_DOWNLOAD_BYTES_PER_SECOND: value }),
            downloadTimeoutMs(binary, {}),
        );
    }
    // Missing or malformed sizes still get the floor rather than no deadline.
    for (const size of [undefined, null, Number.NaN, -1])
        assert.equal(downloadTimeoutMs(size, {}), MIN_DOWNLOAD_TIMEOUT_MS);
});

const IDLE_MS = 80;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A fake fetch whose body yields one byte per entry after that entry's delay; null never yields. */
function fakeFetch(delays, { headerDelay = 0 } = {}) {
    return async () => {
        if (headerDelay === null) return new Promise(() => undefined);
        await pause(headerDelay);
        let index = 0;
        return {
            ok: true,
            status: 200,
            statusText: "OK",
            headers: new Headers(),
            body: new ReadableStream({
                async pull(controller) {
                    if (index === delays.length) return controller.close();
                    const delay = delays[index++];
                    if (delay === null) return new Promise(() => undefined);
                    await pause(delay);
                    controller.enqueue(new Uint8Array([index]));
                },
            }),
        };
    };
}

async function readAll(response) {
    const bytes = [];
    for await (const chunk of response.body) bytes.push(...chunk);
    return bytes;
}

test("a slow download that keeps delivering data outlasts the idle limit", async () => {
    // Ten chunks at half the idle limit each take far longer than the limit in total.
    const fetch = withIdleTimeout(fakeFetch(Array(10).fill(IDLE_MS / 2)), IDLE_MS);
    const started = Date.now();
    assert.deepEqual(await readAll(await fetch("https://example.test/slow")), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert(Date.now() - started > IDLE_MS * 2);
});

test("a download that stops delivering data fails after the idle limit", async () => {
    const fetch = withIdleTimeout(fakeFetch([0, 0, null]), IDLE_MS);
    const response = await fetch("https://example.test/stalled");
    const started = Date.now();
    await assert.rejects(
        readAll(response),
        /Download stalled: no data for 80 ms from https:\/\/example\.test\/stalled/u,
    );
    assert(Date.now() - started < IDLE_MS * 4);
});

test("a response that never arrives fails after the idle limit", async () => {
    const fetch = withIdleTimeout(fakeFetch([], { headerDelay: null }), IDLE_MS);
    await assert.rejects(fetch("https://example.test/silent"), /Download stalled/u);
});

test("the caller's deadline still aborts a download that is receiving data", async () => {
    const fetch = withIdleTimeout(fakeFetch(Array(50).fill(IDLE_MS / 4)), IDLE_MS);
    const response = await fetch("https://example.test/long", { signal: AbortSignal.timeout(IDLE_MS) });
    await assert.rejects(readAll(response), (error) => error.name === "TimeoutError");
});

test("a completed download leaves no idle timer running", async () => {
    const fetch = withIdleTimeout(fakeFetch([0]), 60_000);
    assert.deepEqual(await readAll(await fetch("https://example.test/done")), [1]);
    // node:test would wait for a pending 60 s timer before reporting this file as finished.
});

test("reads the idle limit from the environment", () => {
    assert.equal(downloadIdleTimeoutMs({}), DEFAULT_DOWNLOAD_IDLE_TIMEOUT_MS);
    assert.equal(downloadIdleTimeoutMs({ FORMA_RELEASE_DOWNLOAD_IDLE_TIMEOUT_MS: "90000" }), 90_000);
    for (const value of ["0", "-5", "soon", ""]) {
        assert.equal(
            downloadIdleTimeoutMs({ FORMA_RELEASE_DOWNLOAD_IDLE_TIMEOUT_MS: value }),
            DEFAULT_DOWNLOAD_IDLE_TIMEOUT_MS,
        );
    }
});
