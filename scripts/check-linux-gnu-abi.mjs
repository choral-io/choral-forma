import { execFileSync } from "node:child_process";

const [binary, maximumVersion] = process.argv.slice(2);

if (!binary || !maximumVersion) {
    console.error("Usage: node scripts/check-linux-gnu-abi.mjs <elf> <maximum-glibc-version>");
    process.exit(2);
}

let readelfOutput;
try {
    readelfOutput = execFileSync("readelf", ["--version-info", binary], { encoding: "utf8" });
} catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Unable to inspect ${binary} with readelf: ${detail}`);
    process.exit(1);
}

const versions = [...readelfOutput.matchAll(/GLIBC_(\d+(?:\.\d+)+)/gu)]
    .map((match) => match[1])
    .filter((version, index, all) => all.indexOf(version) === index)
    .sort(compareVersions);

const highestVersion = versions.at(-1);
if (!highestVersion) {
    console.error(`No GLIBC symbol versions were found in ${binary}.`);
    process.exit(1);
}

if (compareVersions(highestVersion, maximumVersion) > 0) {
    console.error(
        `${binary} requires GLIBC_${highestVersion}, above the Linux GNU compatibility ceiling GLIBC_${maximumVersion}.`,
    );
    process.exit(1);
}

console.log(`${binary} requires at most GLIBC_${highestVersion}; ceiling is GLIBC_${maximumVersion}.`);

function compareVersions(left, right) {
    const leftParts = left.split(".").map(Number);
    const rightParts = right.split(".").map(Number);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
        const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
        if (difference !== 0) return difference;
    }
    return 0;
}
