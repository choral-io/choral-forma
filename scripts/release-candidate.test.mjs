import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    assembleReleaseCandidate,
    assertSourceSha,
    verifyReleaseCandidate,
    verifyReleaseCandidateSubset,
} from "./release-candidate.mjs";
import { expectedReleaseAssetNames, sha256File } from "./release-verification.mjs";

const VERSION = "0.1.26";
const SOURCE_SHA = "a".repeat(40);

test("assembles a source-bound manifest for exactly the expected release assets", async (t) => {
    const assetsDirectory = await createReleaseAssets(t);
    const manifest = await assembleReleaseCandidate({ assetsDirectory, sourceSha: SOURCE_SHA, version: VERSION });

    assert.deepEqual(Object.keys(manifest), [
        "schemaVersion",
        "operation",
        "status",
        "version",
        "tag",
        "sourceSha",
        "assets",
    ]);
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.operation, "release-candidate");
    assert.equal(manifest.status, "assembled");
    assert.equal(manifest.version, VERSION);
    assert.equal(manifest.tag, `v${VERSION}`);
    assert.equal(manifest.sourceSha, SOURCE_SHA);
    assert.deepEqual(
        manifest.assets.map((asset) => asset.name),
        expectedReleaseAssetNames(VERSION),
    );
    assert.equal(manifest.assets.length, 22);
    assert.ok(
        manifest.assets.every((asset) => Number.isSafeInteger(asset.size) && /^[a-f0-9]{64}$/u.test(asset.sha256)),
    );
});

test("rejects missing and unexpected candidate assets", async (t) => {
    const assetsDirectory = await createReleaseAssets(t);
    await rm(path.join(assetsDirectory, "forma-linux-arm64"));
    await writeFile(path.join(assetsDirectory, "extra.txt"), "extra\n", "utf8");

    await assert.rejects(
        assembleReleaseCandidate({ assetsDirectory, sourceSha: SOURCE_SHA, version: VERSION }),
        /Missing: forma-linux-arm64\. Unexpected: extra\.txt\./u,
    );
});

test("rejects checksum payload digests and filenames that do not match", async (t) => {
    const assetsDirectory = await createReleaseAssets(t);
    await writeFile(
        path.join(assetsDirectory, "forma-linux-arm64.sha256"),
        `${"0".repeat(64)}  forma-linux-arm64\n`,
        "utf8",
    );
    await assert.rejects(
        assembleReleaseCandidate({ assetsDirectory, sourceSha: SOURCE_SHA, version: VERSION }),
        /Checksum digest mismatch for forma-linux-arm64/u,
    );

    await writeFile(
        path.join(assetsDirectory, "forma-linux-arm64.sha256"),
        `${"0".repeat(64)}  forma-linux-x64\n`,
        "utf8",
    );
    await assert.rejects(
        assembleReleaseCandidate({ assetsDirectory, sourceSha: SOURCE_SHA, version: VERSION }),
        /Checksum names forma-linux-x64 instead of forma-linux-arm64/u,
    );
});

test("verifies an exact manifest and rejects source or asset drift", async (t) => {
    const assetsDirectory = await createReleaseAssets(t);
    const manifest = await assembleReleaseCandidate({ assetsDirectory, sourceSha: SOURCE_SHA, version: VERSION });
    await assert.doesNotReject(verifyReleaseCandidate({ assetsDirectory, manifest, sourceSha: SOURCE_SHA }));

    await assert.rejects(
        verifyReleaseCandidate({
            assetsDirectory,
            manifest: { ...manifest, sourceSha: "b".repeat(40) },
            sourceSha: SOURCE_SHA,
        }),
        /source SHA mismatch/u,
    );
    await writeFile(path.join(assetsDirectory, "forma-linux-arm64"), "changed\n", "utf8");
    await assert.rejects(
        verifyReleaseCandidate({ assetsDirectory, manifest, sourceSha: SOURCE_SHA }),
        /does not match its manifest size and digest/u,
    );
});

test("verifies a matching published subset and reports only missing assets", async (t) => {
    const assetsDirectory = await createReleaseAssets(t);
    const manifest = await assembleReleaseCandidate({ assetsDirectory, sourceSha: SOURCE_SHA, version: VERSION });
    await rm(path.join(assetsDirectory, "forma-linux-arm64"));
    await rm(path.join(assetsDirectory, "forma-linux-arm64.sha256"));

    assert.deepEqual(await verifyReleaseCandidateSubset({ assetsDirectory, manifest, sourceSha: SOURCE_SHA }), {
        presentNames: expectedReleaseAssetNames(VERSION).filter(
            (name) => name !== "forma-linux-arm64" && name !== "forma-linux-arm64.sha256",
        ),
        missingNames: ["forma-linux-arm64", "forma-linux-arm64.sha256"],
    });
    await assert.rejects(
        verifyReleaseCandidate({ assetsDirectory, manifest, sourceSha: SOURCE_SHA }),
        /inventory is incomplete/u,
    );
});

test("rejects unexpected, duplicate, and malformed subset manifest entries", async (t) => {
    const assetsDirectory = await createReleaseAssets(t);
    const manifest = await assembleReleaseCandidate({ assetsDirectory, sourceSha: SOURCE_SHA, version: VERSION });
    const malformed = {
        ...manifest,
        assets: [...manifest.assets, manifest.assets[0]],
    };
    await assert.rejects(
        verifyReleaseCandidateSubset({ assetsDirectory, manifest: malformed, sourceSha: SOURCE_SHA }),
        /invalid or duplicate asset metadata/u,
    );

    await writeFile(path.join(assetsDirectory, "unexpected"), "unexpected\n", "utf8");
    await assert.rejects(
        verifyReleaseCandidateSubset({ assetsDirectory, manifest, sourceSha: SOURCE_SHA }),
        /unexpected asset/u,
    );
});

test("CLI assembles and verifies a manifest", async (t) => {
    const assetsDirectory = await createReleaseAssets(t);
    const manifestPath = path.join(path.dirname(assetsDirectory), "candidate-manifest.json");
    const assemble = runCli(
        "assemble",
        "--assets-dir",
        assetsDirectory,
        "--version",
        VERSION,
        "--source-sha",
        SOURCE_SHA,
        "--output",
        manifestPath,
    );
    assert.equal(assemble.status, 0, assemble.stderr);
    assert.equal(JSON.parse(await readFile(manifestPath, "utf8")).tag, `v${VERSION}`);

    const verify = runCli(
        "verify",
        "--assets-dir",
        assetsDirectory,
        "--manifest",
        manifestPath,
        "--source-sha",
        SOURCE_SHA,
    );
    assert.equal(verify.status, 0, verify.stderr);
});

test("requires an unprefixed SemVer version and a 40-character source SHA", () => {
    assert.equal(assertSourceSha("A".repeat(40)), SOURCE_SHA);
    assert.throws(() => assertSourceSha("a".repeat(39)), /40 hexadecimal/u);
    assert.throws(() => assertSourceSha("not-a-sha"), /40 hexadecimal/u);
});

async function createReleaseAssets(t) {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "forma-release-candidate-"));
    t.after(async () => await rm(temporaryDirectory, { force: true, recursive: true }));
    const assetsDirectory = path.join(temporaryDirectory, "assets");
    await writeFile(path.join(temporaryDirectory, ".keep"), "", "utf8");
    await mkdir(assetsDirectory);

    const names = expectedReleaseAssetNames(VERSION);
    for (const name of names.filter((name) => !name.endsWith(".sha256"))) {
        await writeFile(path.join(assetsDirectory, name), `payload for ${name}\n`, "utf8");
    }
    for (const name of names.filter((name) => name.endsWith(".sha256"))) {
        const payloadName = name.slice(0, -".sha256".length);
        const digest = await sha256File(path.join(assetsDirectory, payloadName));
        await writeFile(path.join(assetsDirectory, name), `${digest}  ${payloadName}\n`, "utf8");
    }
    return assetsDirectory;
}

function runCli(...argumentsList) {
    return spawnSync(
        process.execPath,
        [new URL("./release-candidate.mjs", import.meta.url).pathname, ...argumentsList],
        {
            encoding: "utf8",
        },
    );
}
