import { readFile } from "node:fs/promises";

import {
    cargoLockPackageVersions,
    cargoWorkspaceVersion,
    resolveReleaseTag,
    validateReleaseVersions,
} from "./release-version.mjs";

const cargo = await readFile(new URL("../Cargo.toml", import.meta.url), "utf8");
const cargoLock = await readFile(new URL("../Cargo.lock", import.meta.url), "utf8");
const extension = JSON.parse(
    await readFile(new URL("../packages/vscode-extension/package.json", import.meta.url), "utf8"),
);
const extensionReadme = await readFile(new URL("../packages/vscode-extension/README.md", import.meta.url), "utf8");
const changelog = await readFile(new URL("../packages/vscode-extension/CHANGELOG.md", import.meta.url), "utf8");
const rootReadme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const cargoVersion = cargoWorkspaceVersion(cargo);
const release = await readOptional(new URL(`../knowledge/releases/forma-v${cargoVersion}.md`, import.meta.url));
const releaseVersion = /^version:\s*["']?([^\s"']+)["']?\s*$/mu.exec(release)?.[1] ?? "missing";
const tag = resolveReleaseTag(process.argv[2]);
const errors = validateReleaseVersions({
    cargoVersion,
    changelog,
    extensionName: extension.name,
    extensionPublisher: extension.publisher,
    extensionReadme,
    extensionVersion: extension.version,
    lockVersions: cargoLockPackageVersions(cargoLock),
    releaseVersion,
    rootReadme,
    tag,
});

if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
} else {
    console.log(`Forma release versions align at ${cargoVersion}${tag ? ` (${tag})` : ""}.`);
}

async function readOptional(url) {
    try {
        return await readFile(url, "utf8");
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return "";
        throw error;
    }
}
