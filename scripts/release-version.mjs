import { readFile, writeFile } from "node:fs/promises";

export const internalCargoPackages = ["forma-cli", "forma-core", "forma-lsp", "forma-rpc", "forma-zed-extension"];

const releaseVersionPattern =
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u;
const releaseVersionSource =
    "\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?";

export function resolveReleaseTag(argument, environment = process.env) {
    return argument ?? environment.RELEASE_TAG;
}

export function assertReleaseVersion(version) {
    if (!releaseVersionPattern.test(version)) {
        throw new Error(`Invalid release version: ${version}. Pass a SemVer value without a leading v.`);
    }
    return version;
}

export function cargoWorkspaceVersion(source) {
    const section = /^\[workspace\.package\]\s*$/mu.exec(source);
    if (!section) return "missing";
    const remainder = source.slice(section.index + section[0].length);
    const nextSection = /^\[/mu.exec(remainder)?.index ?? remainder.length;
    return /^version\s*=\s*"([^"]+)"\s*$/mu.exec(remainder.slice(0, nextSection))?.[1] ?? "missing";
}

export function replaceCargoWorkspaceVersion(source, nextVersion) {
    const currentVersion = cargoWorkspaceVersion(source);
    if (currentVersion === "missing") throw new Error("Cargo workspace package version is missing.");
    return source.replace(/(^\[workspace\.package\]\s*$[\s\S]*?^version\s*=\s*")[^"]+("\s*$)/mu, `$1${nextVersion}$2`);
}

export function extensionManifestVersion(source) {
    return /^version\s*=\s*"([^"]+)"\s*$/mu.exec(source)?.[1] ?? "missing";
}

export function replaceExtensionManifestVersion(source, nextVersion) {
    const currentVersion = extensionManifestVersion(source);
    if (currentVersion === "missing") throw new Error("Zed extension manifest version is missing.");
    return source.replace(/(^version\s*=\s*")[^"]+("\s*$)/mu, `$1${nextVersion}$2`);
}

export function replaceCurrentVersion(source, currentVersion, nextVersion, label) {
    if (currentVersion === nextVersion) return source;
    if (!source.includes(currentVersion)) {
        throw new Error(`${label} does not contain the current release version ${currentVersion}.`);
    }
    return source.replaceAll(currentVersion, nextVersion);
}

export function cargoLockPackageVersions(source, packageNames = internalCargoPackages) {
    const wanted = new Set(packageNames);
    const versions = new Map();
    for (const block of source.split("[[package]]").slice(1)) {
        const name = /^\s*name\s*=\s*"([^"]+)"\s*$/mu.exec(block)?.[1];
        if (!name || !wanted.has(name)) continue;
        const version = /^\s*version\s*=\s*"([^"]+)"\s*$/mu.exec(block)?.[1] ?? "missing";
        versions.set(name, version);
    }
    return versions;
}

export function replaceCargoLockPackageVersions(source, nextVersion, packageNames = internalCargoPackages) {
    const wanted = new Set(packageNames);
    const found = new Set();
    const blocks = source.split("[[package]]");
    for (let index = 1; index < blocks.length; index += 1) {
        const name = /^\s*name\s*=\s*"([^"]+)"\s*$/mu.exec(blocks[index])?.[1];
        if (!name || !wanted.has(name)) continue;
        if (!/^\s*version\s*=\s*"[^"]+"\s*$/mu.test(blocks[index])) {
            throw new Error(`Cargo.lock ${name} package version is missing.`);
        }
        blocks[index] = blocks[index].replace(/(^\s*version\s*=\s*")[^"]+("\s*$)/mu, `$1${nextVersion}$2`);
        found.add(name);
    }
    const missing = [...wanted].filter((name) => !found.has(name));
    if (missing.length > 0) throw new Error(`Cargo.lock packages are missing: ${missing.join(", ")}.`);
    return blocks.join("[[package]]");
}

export function documentReleaseVersions(source) {
    const normalizedSource = source.replace(new RegExp(`(forma-v${releaseVersionSource})\\.md\\b`, "gu"), "$1");
    const patterns = [
        new RegExp(`\\bv(${releaseVersionSource})\\b`, "gu"),
        new RegExp(`forma-(${releaseVersionSource})\\.vsix\\b`, "gu"),
        new RegExp(`choral-forma@(${releaseVersionSource})\\b`, "gu"),
        new RegExp(`"github:choral-io/choral-forma"\\s*=\\s*"(${releaseVersionSource})"`, "gu"),
    ];
    return patterns.flatMap((pattern) => [...normalizedSource.matchAll(pattern)].map((match) => match[1]));
}

export function validateReleaseVersions({
    cargoVersion,
    changelog,
    extensionName,
    extensionPublisher,
    extensionReadme,
    extensionVersion,
    lockVersions,
    releaseVersion,
    rootReadme,
    tag,
    zedExtensionVersion,
}) {
    const errors = [];
    if (cargoVersion === "missing") errors.push("Cargo workspace package version is missing.");
    if (extensionVersion !== cargoVersion) {
        errors.push(`VS Code extension version is ${extensionVersion}; expected ${cargoVersion}.`);
    }
    if (extensionName !== "forma") errors.push(`VS Code extension name is ${extensionName}; expected forma.`);
    if (extensionPublisher !== "choral-io") {
        errors.push(`VS Code extension publisher is ${extensionPublisher}; expected choral-io.`);
    }
    if (zedExtensionVersion !== cargoVersion) {
        errors.push(`Zed extension version is ${zedExtensionVersion}; expected ${cargoVersion}.`);
    }
    for (const packageName of internalCargoPackages) {
        const lockVersion = lockVersions.get(packageName) ?? "missing";
        if (lockVersion !== cargoVersion) {
            errors.push(`Cargo.lock ${packageName} version is ${lockVersion}; expected ${cargoVersion}.`);
        }
    }
    if (releaseVersion !== `v${cargoVersion}`) {
        errors.push(`Release record version is ${releaseVersion}; expected v${cargoVersion}.`);
    }
    if (!changelog.includes(`## ${cargoVersion}`)) {
        errors.push(`VS Code extension changelog has no ${cargoVersion} entry.`);
    }
    for (const [label, source] of [
        ["Root README", rootReadme],
        ["VS Code extension README", extensionReadme],
    ]) {
        const stale = [...new Set(documentReleaseVersions(source).filter((version) => version !== cargoVersion))];
        if (stale.length > 0) errors.push(`${label} contains stale release versions: ${stale.join(", ")}.`);
    }
    if (tag && tag !== `v${cargoVersion}`) errors.push(`Release tag is ${tag}; expected v${cargoVersion}.`);
    return errors;
}

const projectRoot = new URL("../", import.meta.url);
const files = {
    cargo: new URL("Cargo.toml", projectRoot),
    cargoLock: new URL("Cargo.lock", projectRoot),
    extension: new URL("extensions/vscode/package.json", projectRoot),
    rootReadme: new URL("README.md", projectRoot),
    zedExtension: new URL("extensions/zed/extension.toml", projectRoot),
};

async function readReleaseSources() {
    return Object.fromEntries(
        await Promise.all(Object.entries(files).map(async ([name, url]) => [name, await readFile(url, "utf8")])),
    );
}

async function checkReleaseVersion(argument) {
    const sources = await readReleaseSources();
    const extension = JSON.parse(sources.extension);
    const extensionReadme = await readFile(new URL("extensions/vscode/README.md", projectRoot), "utf8");
    const changelog = await readFile(new URL("extensions/vscode/CHANGELOG.md", projectRoot), "utf8");
    const cargoVersion = cargoWorkspaceVersion(sources.cargo);
    const release = await readFile(new URL(`knowledge/releases/forma-v${cargoVersion}.md`, projectRoot), "utf8").catch(
        (error) => {
            if (error.code === "ENOENT") return "";
            throw error;
        },
    );
    const releaseVersion = /^version:\s*["']?([^\s"']+)["']?\s*$/mu.exec(release)?.[1] ?? "missing";
    const tag = resolveReleaseTag(argument);
    const errors = validateReleaseVersions({
        cargoVersion,
        changelog,
        extensionName: extension.name,
        extensionPublisher: extension.publisher,
        extensionReadme,
        extensionVersion: extension.version,
        lockVersions: cargoLockPackageVersions(sources.cargoLock),
        releaseVersion,
        rootReadme: sources.rootReadme,
        tag,
        zedExtensionVersion: extensionManifestVersion(sources.zedExtension),
    });
    if (errors.length > 0) {
        for (const error of errors) console.error(error);
        return 1;
    }
    console.log(`Forma release versions align at ${cargoVersion}${tag ? ` (${tag})` : ""}.`);
    return 0;
}

async function setReleaseVersion(args) {
    const dryRun = args.includes("--dry-run");
    const positionals = args.filter((argument) => argument !== "--dry-run");
    if (positionals.length !== 1) {
        console.error("Usage: mise run version:set -- <version> [--dry-run]");
        return 2;
    }

    const nextVersion = assertReleaseVersion(positionals[0]);
    const sources = await readReleaseSources();
    const currentVersion = cargoWorkspaceVersion(sources.cargo);
    const extension = JSON.parse(sources.extension);
    const zedExtensionVersion = extensionManifestVersion(sources.zedExtension);
    if (extension.version !== currentVersion) {
        throw new Error(
            `Refusing to set a new version while Cargo (${currentVersion}) and the extension (${extension.version}) differ.`,
        );
    }
    if (zedExtensionVersion !== currentVersion) {
        throw new Error(
            `Refusing to set a new version while Cargo (${currentVersion}) and the Zed extension (${zedExtensionVersion}) differ.`,
        );
    }

    extension.version = nextVersion;
    const updates = [
        [files.cargo, sources.cargo, replaceCargoWorkspaceVersion(sources.cargo, nextVersion)],
        [files.cargoLock, sources.cargoLock, replaceCargoLockPackageVersions(sources.cargoLock, nextVersion)],
        [files.extension, sources.extension, `${JSON.stringify(extension, null, 2)}\n`],
        [files.zedExtension, sources.zedExtension, replaceExtensionManifestVersion(sources.zedExtension, nextVersion)],
        [
            files.rootReadme,
            sources.rootReadme,
            replaceCurrentVersion(sources.rootReadme, currentVersion, nextVersion, "Root README"),
        ],
    ];
    const changed = updates.filter(([, before, after]) => before !== after);
    for (const [url, , after] of changed) {
        const path = decodeURIComponent(url.pathname.slice(projectRoot.pathname.length));
        console.log(`${dryRun ? "Would update" : "Updating"} ${path}`);
        if (!dryRun) await writeFile(url, after);
    }

    if (changed.length === 0) console.log(`Forma is already set to ${nextVersion}.`);
    else console.log(`${dryRun ? "Dry run would set" : "Set"} Forma from ${currentVersion} to ${nextVersion}.`);

    console.log("Manual release content still required:");
    console.log(`- add a ${nextVersion} entry to extensions/vscode/CHANGELOG.md`);
    console.log(`- create knowledge/releases/forma-v${nextVersion}.md with version: v${nextVersion}`);
    console.log("- run mise run version:check after completing the release content");
    return 0;
}

export async function runReleaseVersionCommand(command, args) {
    if (command === "check") return checkReleaseVersion(args[0]);
    if (command === "set") return setReleaseVersion(args);
    console.error("Usage: node scripts/release-version.mjs <check|set> [arguments]");
    return 2;
}

if (import.meta.main) {
    const [, , command, ...args] = process.argv;
    process.exitCode = await runReleaseVersionCommand(command, args);
}
