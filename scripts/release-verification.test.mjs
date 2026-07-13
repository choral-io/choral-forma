import assert from "node:assert/strict";
import test from "node:test";

import {
    expectedReleaseAssetNames,
    parsePublishedChecksum,
    releaseVersionFromTag,
    validateReleaseMetadata,
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
