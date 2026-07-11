import { readFile } from "node:fs/promises";

import { expectedReleaseVersion, resolveReleaseTag, validateReleaseVersions } from "./release-version.mjs";

const cargo = await readFile(new URL("../Cargo.toml", import.meta.url), "utf8");
const extension = JSON.parse(
    await readFile(new URL("../packages/vscode-extension/package.json", import.meta.url), "utf8"),
);
const release = await readFile(new URL("../knowledge/releases/next-internal-release.md", import.meta.url), "utf8");

const cargoVersion = /^version\s*=\s*"([^"]+)"$/mu.exec(cargo)?.[1] ?? "missing";
const releaseVersion = /^version:\s*["']?([^\s"']+)["']?$/mu.exec(release)?.[1] ?? "missing";
const tag = resolveReleaseTag(process.argv[2]);
const errors = validateReleaseVersions({
    cargoVersion,
    extensionName: extension.name,
    extensionPublisher: extension.publisher,
    extensionVersion: extension.version,
    releaseVersion,
    tag,
});

if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
} else {
    console.log(`Forma release versions align at ${expectedReleaseVersion}${tag ? ` (${tag})` : ""}.`);
}
