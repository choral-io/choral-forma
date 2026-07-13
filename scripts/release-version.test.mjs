import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { expectedReleaseAssetNames } from "./release-verification.mjs";
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

const workflows = await Promise.all(
    ["ci.yml", "release.yml"].map(
        async (name) => await readFile(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8"),
    ),
);

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
    assert.deepEqual(documentReleaseVersions("v0.1.0-alpha.16 and forma-0.1.0-alpha.16.vsix"), [
        "0.1.0-alpha.16",
        "0.1.0-alpha.16",
    ]);
    assert.deepEqual(documentReleaseVersions("VS Code 1.110.0"), []);
});

test("derives workflow VSIX names from the extension manifest", () => {
    for (const workflow of workflows) {
        assert.match(workflow, /packages\/vscode-extension\/package\.json/u);
        assert.doesNotMatch(workflow, /forma-0\.1\.0-alpha\.\d+\.vsix/u);
    }
});

test("passes the built Forma binary to Extension Host tests", () => {
    assert.match(
        workflows[0],
        /Run Extension Host tests[\s\S]*FORMA_TEST_BIN: \$\{\{ github\.workspace \}\}\/target\/debug\/forma/u,
    );
});

test("checks the Zed extension WebAssembly target in CI", () => {
    assert.match(
        workflows[0],
        /rustup target add wasm32-wasip1[\s\S]*cargo check -p forma-zed-extension --target wasm32-wasip1 --locked/u,
    );
});

test("runs packaged VSIX smoke tests under a virtual display", () => {
    for (const workflow of workflows) {
        assert.match(workflow, /Smoke test packaged VSIX[\s\S]*?run: xvfb-run -a pnpm --filter forma smoke:vsix/u);
    }
});

test("publishes standalone editor-managed binaries alongside release archives", () => {
    const releaseWorkflow = workflows[1];
    const expectedRows = [
        {
            archive: "tar.gz",
            asset: "linux-arm64",
            binary: "forma",
            managed_binary: "forma-linux-arm64",
            os: "ubuntu-24.04-arm",
            target: "aarch64-unknown-linux-gnu",
        },
        {
            archive: "tar.gz",
            asset: "linux-x64",
            binary: "forma",
            managed_binary: "forma-linux-x64",
            os: "ubuntu-24.04",
            target: "x86_64-unknown-linux-gnu",
        },
        {
            archive: "tar.gz",
            asset: "macos-arm64",
            binary: "forma",
            managed_binary: "forma-macos-arm64",
            os: "macos-26",
            target: "aarch64-apple-darwin",
        },
        {
            archive: "tar.gz",
            asset: "macos-x64",
            binary: "forma",
            managed_binary: "forma-macos-x64",
            os: "macos-26-intel",
            target: "x86_64-apple-darwin",
        },
        {
            archive: "zip",
            asset: "windows-x64",
            binary: "forma.exe",
            managed_binary: "forma-windows-x64.exe",
            os: "windows-2025",
            target: "x86_64-pc-windows-msvc",
        },
    ];
    const rows = releaseBuildMatrix(releaseWorkflow).map(({ archive, asset, binary, managed_binary, os, target }) => ({
        archive,
        asset,
        binary,
        managed_binary,
        os,
        target,
    }));

    assert.deepEqual(rows, expectedRows, "every supported platform must map to its exact Rust target and assets");
    assertUnique(
        rows.map(({ asset }) => asset),
        "release matrix assets",
    );
    assertUnique(
        rows.map(({ target }) => target),
        "release matrix Rust targets",
    );
    assertUnique(
        rows.map(({ managed_binary }) => managed_binary),
        "managed CLI assets",
    );

    const publishedFiles = rows.flatMap(({ archive, asset, managed_binary }) => {
        const archiveName = `forma-${asset}.${archive}`;
        return [archiveName, `${archiveName}.sha256`, managed_binary, `${managed_binary}.sha256`];
    });
    assert.equal(publishedFiles.length, 20);
    assertUnique(publishedFiles, "standalone release files");
    assert.deepEqual(
        [...publishedFiles, "forma-1.2.3.vsix", "forma-1.2.3.vsix.sha256"].sort(),
        expectedReleaseAssetNames("1.2.3"),
        "release workflow assets and post-release verification inventory must stay aligned",
    );
    assert.match(releaseWorkflow, /dist-release\/\$\{\{ matrix\.managed_binary \}\}\.sha256/u);
    assert.match(releaseWorkflow, /dist-release\/forma-\$\{\{ matrix\.asset \}\}\.\$\{\{ matrix\.archive \}\}/u);
    assert.match(
        releaseWorkflow,
        /name: forma-\$\{\{ matrix\.asset \}\}[\s\S]*?path: \|\n\s+dist-release\/forma-\$\{\{ matrix\.asset \}\}\.\$\{\{ matrix\.archive \}\}\n\s+dist-release\/forma-\$\{\{ matrix\.asset \}\}\.\$\{\{ matrix\.archive \}\}\.sha256\n\s+dist-release\/\$\{\{ matrix\.managed_binary \}\}\n\s+dist-release\/\$\{\{ matrix\.managed_binary \}\}\.sha256/u,
    );
    assert.match(
        releaseWorkflow,
        /name: forma-vscode[\s\S]*?path: \|\n\s+\$\{\{ env\.VSIX_OUT \}\}\n\s+\$\{\{ env\.VSIX_OUT \}\}\.sha256/u,
    );
    assert.doesNotMatch(releaseWorkflow, /gh release (?:create|upload)[^\n]*latest/u);
});

function releaseBuildMatrix(workflow) {
    const matrix = workflow.match(/\n {6}matrix:\n {8}include:\n(?<body>[\s\S]*?)\n {4}steps:/u)?.groups?.body;
    assert.ok(matrix, "release workflow should contain a build matrix");
    const rows = [];
    for (const line of matrix.split("\n")) {
        const first = line.match(/^ {10}- ([a-z_]+): (.+)$/u);
        if (first) {
            rows.push({ [first[1]]: first[2] });
            continue;
        }
        const field = line.match(/^ {12}([a-z_]+): (.+)$/u);
        if (field) {
            assert.ok(rows.length > 0, `matrix field ${field[1]} must belong to a row`);
            rows.at(-1)[field[1]] = field[2];
        }
    }
    return rows;
}

function assertUnique(values, label) {
    assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}
