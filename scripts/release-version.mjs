export const internalCargoPackages = ["forma-cli", "forma-core", "forma-rpc"];

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

export function documentReleaseVersions(source) {
    const patterns = [
        new RegExp(`\\bv(${releaseVersionSource})\\b`, "gu"),
        new RegExp(`forma-(${releaseVersionSource})\\.vsix\\b`, "gu"),
        new RegExp(`choral-forma@(${releaseVersionSource})\\b`, "gu"),
        new RegExp(`"github:choral-io/choral-forma"\\s*=\\s*"(${releaseVersionSource})"`, "gu"),
    ];
    return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]));
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
