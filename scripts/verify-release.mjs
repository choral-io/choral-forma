import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
    expectedReleaseAssetNames,
    parsePublishedChecksum,
    RELEASE_REPOSITORY,
    releaseVersionFromTag,
    sha256File,
    validateReleaseMetadata,
} from "./release-verification.mjs";

const execFileAsync = promisify(execFile);
const extensionPackageUrl = new URL("../extensions/vscode/package.json", import.meta.url);
const extensionRequire = createRequire(extensionPackageUrl);
const { build } = extensionRequire("esbuild");
const { readVSIXPackage } = extensionRequire("@vscode/vsce/out/zip.js");
const MAX_PAYLOAD_BYTES = 128 * 1024 * 1024;
const MAX_CHECKSUM_BYTES = 8 * 1024;
const DOWNLOAD_TIMEOUT_MS = 120_000;

const tag = process.argv[2];

try {
    const result = await verifyRelease(tag);
    console.log(JSON.stringify(result, undefined, 2));
} catch (error) {
    console.error(
        JSON.stringify({
            schemaVersion: 1,
            operation: "release.verify",
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
        }),
    );
    process.exitCode = 1;
}

async function verifyRelease(releaseTag) {
    const version = releaseVersionFromTag(releaseTag);
    const extensionManifest = JSON.parse(await readFile(extensionPackageUrl, "utf8"));
    assertEqual(extensionManifest.version, version, "local extension version");

    const scratch = await mkdtemp(join(tmpdir(), "forma-release-verify-"));
    try {
        const managedModule = await buildManagedCliModule(scratch);
        const target = managedModule.resolveManagedCliTarget(process.platform, process.arch);
        const release = await fetchRelease(releaseTag);
        const assets = validateReleaseMetadata(release, releaseTag);
        const downloader = managedModule.createFetchDownloader();

        const vsixName = `forma-${version}.vsix`;
        const payloadNames = expectedReleaseAssetNames(version).filter((name) => !name.endsWith(".sha256"));
        const publishedDirectory = join(scratch, "published-assets");
        const verifiedPayloads = new Map();
        await mkdir(publishedDirectory);
        for (const payloadName of payloadNames) {
            const payloadPath = join(publishedDirectory, payloadName);
            const checksumName = `${payloadName}.sha256`;
            const checksumPath = join(publishedDirectory, checksumName);
            await downloadAsset(downloader, assets, payloadName, payloadPath, MAX_PAYLOAD_BYTES);
            await downloadAsset(downloader, assets, checksumName, checksumPath, MAX_CHECKSUM_BYTES);
            verifiedPayloads.set(payloadName, await verifyChecksum(payloadPath, checksumPath, payloadName));
        }

        const cliPath = join(publishedDirectory, target.assetName);
        const vsixPath = join(publishedDirectory, vsixName);
        const cliSha256 = verifiedPayloads.get(target.assetName);
        const vsixSha256 = verifiedPayloads.get(vsixName);
        if (!cliSha256 || !vsixSha256) throw new Error("Published release payload verification was incomplete.");
        if (process.platform !== "win32") await chmod(cliPath, 0o755);
        const cliVersion = await commandVersion(cliPath);
        assertEqual(cliVersion, `forma ${version}`, "downloaded CLI version");

        const { manifest: publishedManifest } = await readVSIXPackage(vsixPath);
        assertEqual(publishedManifest.publisher, extensionManifest.publisher, "VSIX publisher");
        assertEqual(publishedManifest.name, extensionManifest.name, "VSIX name");
        assertEqual(publishedManifest.displayName, extensionManifest.displayName, "VSIX display name");
        assertEqual(publishedManifest.version, version, "VSIX version");
        assertEqual(publishedManifest.engines?.vscode, extensionManifest.engines?.vscode, "VSIX VS Code engine");

        const installation = await managedModule.installManagedCli({
            version,
            globalStorage: join(scratch, "managed-storage"),
            timeoutMs: DOWNLOAD_TIMEOUT_MS,
        });
        if (installation.reused) throw new Error("Managed installation unexpectedly reused an existing binary.");
        assertEqual(installation.assetName, target.assetName, "managed CLI asset");
        const managedVersion = await commandVersion(installation.path);
        assertEqual(managedVersion, `forma ${version}`, "managed CLI version");

        return {
            schemaVersion: 1,
            operation: "release.verify",
            status: "passed",
            tag: releaseTag,
            releaseUrl: release.html_url,
            assets: expectedReleaseAssetNames(version).length,
            verifiedPayloads: verifiedPayloads.size,
            host: { platform: process.platform, arch: process.arch, asset: target.assetName },
            cli: { version: cliVersion, sha256: cliSha256 },
            vsix: {
                identity: `${publishedManifest.publisher}.${publishedManifest.name}@${publishedManifest.version}`,
                engine: publishedManifest.engines.vscode,
                sha256: vsixSha256,
            },
            managedInstall: { asset: installation.assetName, version: managedVersion },
        };
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
}

async function buildManagedCliModule(scratch) {
    const outfile = join(scratch, "managed-cli.mjs");
    await build({
        entryPoints: [fileURLToPath(new URL("../extensions/vscode/src/managed-cli.ts", import.meta.url))],
        outfile,
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node24",
        logLevel: "silent",
    });
    return await import(pathToFileURL(outfile).href);
}

async function fetchRelease(releaseTag) {
    const headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "choral-forma-release-verifier",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(
        `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/tags/${encodeURIComponent(releaseTag)}`,
        { headers, signal: AbortSignal.timeout(30_000) },
    );
    if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`GitHub release lookup failed with HTTP ${String(response.status)} ${response.statusText}.`);
    }
    return await response.json();
}

async function downloadAsset(downloader, assets, name, destination, maxBytes) {
    const asset = assets.get(name);
    if (!asset) throw new Error(`Release asset ${name} is missing.`);
    await downloader({
        url: asset.browser_download_url,
        destination,
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        maxBytes,
    });
}

async function verifyChecksum(payloadPath, checksumPath, expectedName) {
    const expected = parsePublishedChecksum(await readFile(checksumPath, "utf8"), expectedName);
    const actual = await sha256File(payloadPath);
    if (actual !== expected) {
        throw new Error(`Checksum mismatch for ${basename(payloadPath)}: expected ${expected}, received ${actual}.`);
    }
    return actual;
}

async function commandVersion(command) {
    const { stdout } = await execFileAsync(command, ["--version"], { timeout: 30_000, windowsHide: true });
    return stdout.trim();
}

function assertEqual(actual, expected, label) {
    if (actual !== expected)
        throw new Error(`${label} mismatch: expected ${String(expected)}, received ${String(actual)}.`);
}
