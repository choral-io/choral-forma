export const expectedReleaseVersion = "0.1.0-alpha.13";

export function resolveReleaseTag(argument, environment = process.env) {
    return argument ?? environment.RELEASE_TAG;
}

export function validateReleaseVersions({
    cargoVersion,
    extensionName,
    extensionPublisher,
    extensionVersion,
    releaseVersion,
    tag,
}) {
    const errors = [];
    if (cargoVersion !== expectedReleaseVersion) {
        errors.push(`Cargo workspace version is ${cargoVersion}; expected ${expectedReleaseVersion}.`);
    }
    if (extensionVersion !== expectedReleaseVersion) {
        errors.push(`VS Code extension version is ${extensionVersion}; expected ${expectedReleaseVersion}.`);
    }
    if (extensionName !== "forma") {
        errors.push(`VS Code extension name is ${extensionName}; expected forma.`);
    }
    if (extensionPublisher !== "choral-io") {
        errors.push(`VS Code extension publisher is ${extensionPublisher}; expected choral-io.`);
    }
    if (releaseVersion !== `v${expectedReleaseVersion}`) {
        errors.push(`Release record version is ${releaseVersion}; expected v${expectedReleaseVersion}.`);
    }
    if (tag && tag !== `v${expectedReleaseVersion}`) {
        errors.push(`Release tag is ${tag}; expected v${expectedReleaseVersion}.`);
    }
    return errors;
}
