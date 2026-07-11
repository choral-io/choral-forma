import assert from "node:assert/strict";
import test from "node:test";

import { expectedReleaseVersion, resolveReleaseTag, validateReleaseVersions } from "./release-version.mjs";

test("only treats an explicit release input as a tag", () => {
    assert.equal(resolveReleaseTag(undefined, { GITHUB_REF_NAME: "1/merge" }), undefined);
    assert.equal(
        resolveReleaseTag(undefined, {
            GITHUB_REF_NAME: "1/merge",
            RELEASE_TAG: `v${expectedReleaseVersion}`,
        }),
        `v${expectedReleaseVersion}`,
    );
    assert.equal(
        resolveReleaseTag(`v${expectedReleaseVersion}`, {
            RELEASE_TAG: "v0.1.0-alpha.12",
        }),
        `v${expectedReleaseVersion}`,
    );
});

test("accepts aligned Forma release versions", () => {
    assert.deepEqual(
        validateReleaseVersions({
            cargoVersion: expectedReleaseVersion,
            extensionName: "forma",
            extensionPublisher: "choral-io",
            extensionVersion: expectedReleaseVersion,
            releaseVersion: `v${expectedReleaseVersion}`,
            tag: `v${expectedReleaseVersion}`,
        }),
        [],
    );
});

test("rejects mismatched Cargo, extension, release, and tag versions", () => {
    const errors = validateReleaseVersions({
        cargoVersion: "0.1.0",
        extensionName: "forma",
        extensionPublisher: "choral-io",
        extensionVersion: "0.1.0-alpha.12",
        releaseVersion: "v0.1.0-alpha.11",
        tag: "v0.1.0-alpha.10",
    });
    assert.equal(errors.length, 4);
});

test("rejects an extension identity that cannot produce choral-io.forma", () => {
    const errors = validateReleaseVersions({
        cargoVersion: expectedReleaseVersion,
        extensionName: "@choral-forma/vscode-extension",
        extensionPublisher: "other",
        extensionVersion: expectedReleaseVersion,
        releaseVersion: `v${expectedReleaseVersion}`,
        tag: `v${expectedReleaseVersion}`,
    });
    assert.equal(errors.length, 2);
});
