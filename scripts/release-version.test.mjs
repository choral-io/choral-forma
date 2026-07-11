import assert from "node:assert/strict";
import test from "node:test";

import { expectedReleaseVersion, validateReleaseVersions } from "./release-version.mjs";

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
