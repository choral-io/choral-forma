import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    assertReleaseVersion,
    cargoLockPackageVersions,
    cargoWorkspaceVersion,
    documentReleaseVersions,
    extensionManifestVersion,
    replaceCargoLockPackageVersions,
    replaceCargoWorkspaceVersion,
    replaceCurrentVersion,
    replaceExtensionManifestVersion,
    resolveReleaseTag,
    validateReleaseVersions,
} from "./release-version.mjs";

const pnpmWorkspace = await readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const webappPackage = JSON.parse(await readFile(new URL("../packages/webapp/package.json", import.meta.url), "utf8"));

test("keeps parallel pnpm gates from mutating the dependency installation", () => {
    assert.match(pnpmWorkspace, /^verifyDepsBeforeRun:\s+false$/mu);
});

test("keeps the WebApp release build portable across runner shells", () => {
    assert.doesNotMatch(
        webappPackage.scripts.build,
        /(?:^|&&\s+)[A-Z_][A-Z0-9_]*=/u,
        "release builds run this script on Windows, where POSIX inline environment assignments fail",
    );
});

test("only treats an explicit release input as a tag", () => {
    assert.equal(resolveReleaseTag(undefined, { GITHUB_REF_NAME: "1/merge" }), undefined);
    assert.equal(
        resolveReleaseTag(undefined, { GITHUB_REF_NAME: "1/merge", RELEASE_TAG: "v0.1.0-alpha.16" }),
        "v0.1.0-alpha.16",
    );
    assert.equal(resolveReleaseTag("v0.1.0-alpha.16", { RELEASE_TAG: "v0.1.0-alpha.15" }), "v0.1.0-alpha.16");
});

test("reads and replaces only the Cargo workspace package version", () => {
    const cargo = `[workspace]\nmembers = []\n\n[workspace.package]\nrust-version = "1.95"\nversion = "0.1.0-alpha.15"\n\n[profile.release]\ncodegen-units = 1\n`;
    assert.equal(cargoWorkspaceVersion(cargo), "0.1.0-alpha.15");
    const updated = replaceCargoWorkspaceVersion(cargo, "0.1.0-alpha.16");
    assert.equal(cargoWorkspaceVersion(updated), "0.1.0-alpha.16");
    assert.match(updated, /\[profile\.release\]\ncodegen-units = 1/u);
});

test("validates release version input without accepting a tag", () => {
    assert.equal(assertReleaseVersion("0.1.0-alpha.16"), "0.1.0-alpha.16");
    assert.equal(assertReleaseVersion("1.2.3"), "1.2.3");
    assert.throws(() => assertReleaseVersion("v0.1.0-alpha.16"), /without a leading v/u);
    assert.throws(() => assertReleaseVersion("alpha.16"), /Invalid release version/u);
});

test("reads and replaces the Zed extension manifest version", () => {
    const manifest = 'id = "forma"\nversion = "0.1.0-alpha.15"\nschema_version = 1\n';
    assert.equal(extensionManifestVersion(manifest), "0.1.0-alpha.15");
    assert.equal(
        extensionManifestVersion(replaceExtensionManifestVersion(manifest, "0.1.0-alpha.16")),
        "0.1.0-alpha.16",
    );
});

test("updates allowlisted current-version documentation", () => {
    const source = "Install v0.1.0-alpha.15 or forma-0.1.0-alpha.15.vsix.";
    assert.equal(
        replaceCurrentVersion(source, "0.1.0-alpha.15", "0.1.0-alpha.16", "README"),
        "Install v0.1.0-alpha.16 or forma-0.1.0-alpha.16.vsix.",
    );
    assert.throws(
        () => replaceCurrentVersion("No version", "0.1.0-alpha.15", "0.1.0-alpha.16", "README"),
        /does not contain/u,
    );
});

test("extracts internal workspace versions from Cargo.lock", () => {
    const lock = `[[package]]\nname = "forma-cli"\nversion = "0.1.0-alpha.16"\n\n[[package]]\nname = "serde"\nversion = "1.0.0"\n\n[[package]]\nname = "forma-core"\nversion = "0.1.0-alpha.16"\n\n[[package]]\nname = "forma-lsp"\nversion = "0.1.0-alpha.16"\n\n[[package]]\nname = "forma-rpc"\nversion = "0.1.0-alpha.16"\n\n[[package]]\nname = "forma-zed-extension"\nversion = "0.1.0-alpha.16"\n`;
    assert.deepEqual(Object.fromEntries(cargoLockPackageVersions(lock)), {
        "forma-cli": "0.1.0-alpha.16",
        "forma-core": "0.1.0-alpha.16",
        "forma-lsp": "0.1.0-alpha.16",
        "forma-rpc": "0.1.0-alpha.16",
        "forma-zed-extension": "0.1.0-alpha.16",
    });
});

test("updates only internal workspace versions in Cargo.lock", () => {
    const lock = `[[package]]\nname = "forma-cli"\nversion = "0.1.0-alpha.15"\n\n[[package]]\nname = "serde"\nversion = "1.0.0"\n\n[[package]]\nname = "forma-core"\nversion = "0.1.0-alpha.15"\n\n[[package]]\nname = "forma-lsp"\nversion = "0.1.0-alpha.15"\n\n[[package]]\nname = "forma-rpc"\nversion = "0.1.0-alpha.15"\n\n[[package]]\nname = "forma-zed-extension"\nversion = "0.1.0-alpha.15"\n`;
    const updated = replaceCargoLockPackageVersions(lock, "0.1.0-alpha.16");
    assert.deepEqual(Object.fromEntries(cargoLockPackageVersions(updated)), {
        "forma-cli": "0.1.0-alpha.16",
        "forma-core": "0.1.0-alpha.16",
        "forma-lsp": "0.1.0-alpha.16",
        "forma-rpc": "0.1.0-alpha.16",
        "forma-zed-extension": "0.1.0-alpha.16",
    });
    assert.match(updated, /name = "serde"\nversion = "1\.0\.0"/u);
    assert.throws(
        () => replaceCargoLockPackageVersions('[[package]]\nname = "forma-cli"\nversion = "old"\n', "new"),
        /packages are missing/u,
    );
});

test("accepts versions derived from the Cargo workspace source", () => {
    const version = "0.1.0-alpha.16";
    const lockVersions = new Map([
        ["forma-cli", version],
        ["forma-core", version],
        ["forma-lsp", version],
        ["forma-rpc", version],
        ["forma-zed-extension", version],
    ]);
    assert.deepEqual(
        validateReleaseVersions({
            cargoVersion: version,
            changelog: `# Changelog\n\n## ${version}\n`,
            extensionName: "forma",
            extensionPublisher: "choral-io",
            extensionReadme: `Download forma-${version}.vsix.`,
            extensionVersion: version,
            lockVersions,
            releaseVersion: `v${version}`,
            rootReadme: `Install v${version}.`,
            tag: `v${version}`,
            zedExtensionVersion: version,
        }),
        [],
    );
});

test("rejects stale manifests, lock entries, release content, documentation, and tags", () => {
    const version = "0.1.0-alpha.16";
    const errors = validateReleaseVersions({
        cargoVersion: version,
        changelog: "# Changelog\n\n## 0.1.0-alpha.15\n",
        extensionName: "@choral-forma/vscode-extension",
        extensionPublisher: "other",
        extensionReadme: "Download forma-0.1.0-alpha.15.vsix.",
        extensionVersion: "0.1.0-alpha.15",
        lockVersions: new Map([["forma-cli", "0.1.0-alpha.15"]]),
        releaseVersion: "v0.1.0-alpha.15",
        rootReadme: "Install v0.1.0-alpha.15.",
        tag: "v0.1.0-alpha.15",
        zedExtensionVersion: "0.1.0-alpha.15",
    });
    assert.ok(errors.some((error) => error.includes("VS Code extension version")));
    assert.ok(errors.some((error) => error.includes("Zed extension version")));
    assert.ok(errors.some((error) => error.includes("Cargo.lock forma-core")));
    assert.ok(errors.some((error) => error.includes("Release record version")));
    assert.ok(errors.some((error) => error.includes("changelog")));
    assert.ok(errors.some((error) => error.includes("Root README")));
    assert.ok(errors.some((error) => error.includes("Release tag")));
});

test("normalizes tagged and untagged versions found in current documentation", () => {
    assert.deepEqual(
        documentReleaseVersions(
            "v0.1.0-alpha.16, forma-0.1.0-alpha.16.vsix, and knowledge/releases/forma-v0.1.0-alpha.16.md",
        ),
        ["0.1.0-alpha.16", "0.1.0-alpha.16", "0.1.0-alpha.16"],
    );
    assert.deepEqual(documentReleaseVersions("VS Code 1.110.0"), []);
});
