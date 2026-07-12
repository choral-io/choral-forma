import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

import {
    assertReleaseVersion,
    cargoWorkspaceVersion,
    replaceCargoWorkspaceVersion,
    replaceCurrentVersion,
} from "./release-version.mjs";

const dryRun = process.argv.includes("--dry-run");
const positionals = process.argv.slice(2).filter((argument) => argument !== "--dry-run");
if (positionals.length !== 1) {
    console.error("Usage: mise run version:set -- <version> [--dry-run]");
    process.exit(2);
}

const nextVersion = assertReleaseVersion(positionals[0]);
const files = {
    cargo: new URL("../Cargo.toml", import.meta.url),
    extension: new URL("../packages/vscode-extension/package.json", import.meta.url),
    rootReadme: new URL("../README.md", import.meta.url),
};
const cargo = await readFile(files.cargo, "utf8");
const currentVersion = cargoWorkspaceVersion(cargo);
const extensionSource = await readFile(files.extension, "utf8");
const extension = JSON.parse(extensionSource);
if (extension.version !== currentVersion) {
    throw new Error(
        `Refusing to set a new version while Cargo (${currentVersion}) and the extension (${extension.version}) differ.`,
    );
}

extension.version = nextVersion;
const updates = [
    [files.cargo, cargo, replaceCargoWorkspaceVersion(cargo, nextVersion)],
    [files.extension, extensionSource, `${JSON.stringify(extension, null, 2)}\n`],
];
const rootReadme = await readFile(files.rootReadme, "utf8");
updates.push([
    files.rootReadme,
    rootReadme,
    replaceCurrentVersion(rootReadme, currentVersion, nextVersion, "Root README"),
]);

const changed = updates.filter(([, before, after]) => before !== after);
for (const [url, , after] of changed) {
    console.log(`${dryRun ? "Would update" : "Updating"} ${relativePath(url)}`);
    if (!dryRun) await writeFile(url, after);
}

if (!dryRun && changed.length > 0) refreshCargoLock();
if (changed.length === 0) console.log(`Forma is already set to ${nextVersion}.`);
else console.log(`${dryRun ? "Dry run would set" : "Set"} Forma from ${currentVersion} to ${nextVersion}.`);

console.log("Manual release content still required:");
console.log(`- add a ${nextVersion} entry to packages/vscode-extension/CHANGELOG.md`);
console.log(`- create knowledge/releases/forma-v${nextVersion}.md with version: v${nextVersion}`);
console.log("- run mise run version:check after completing the release content");

function refreshCargoLock() {
    const result = spawnSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], {
        cwd: new URL("..", import.meta.url),
        stdio: ["ignore", "ignore", "inherit"],
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`cargo metadata failed with exit code ${String(result.status)}.`);
}

function relativePath(url) {
    return decodeURIComponent(url.pathname).replace(
        `${decodeURIComponent(new URL("../", import.meta.url).pathname)}`,
        "",
    );
}
