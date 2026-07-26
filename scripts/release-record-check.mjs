import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { releaseVersionFromTag } from "./release-verification.mjs";

const execFileAsync = promisify(execFile);
const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        const result = await checkReleaseRecord(process.argv[2]);
        console.log(JSON.stringify(result, undefined, 2));
    } catch (error) {
        console.error(
            JSON.stringify({
                schemaVersion: 1,
                operation: "release.record-check",
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
            }),
        );
        process.exitCode = 1;
    }
}

export function releaseRecordPath(tag) {
    return `knowledge/releases/forma-v${releaseVersionFromTag(tag)}.md`;
}

export function assertReleaseRecordHasBacklink(health, tag) {
    if (!health || typeof health !== "object") throw new Error("Workspace health returned an invalid result.");

    const path = releaseRecordPath(tag);
    const findings = Array.isArray(health.findings) ? health.findings : [];
    const diagnostics = Array.isArray(health.diagnostics) ? health.diagnostics : [];
    const hasNoBacklink = [...findings, ...diagnostics].some(
        (finding) =>
            finding &&
            typeof finding === "object" &&
            finding.path === path &&
            (finding.category === "noBacklinks" || finding.code === "workspaceHealth.noBacklinks"),
    );

    if (hasNoBacklink) {
        throw new Error(
            `Release record ${path} has no inbound internal references. Update the Forma Release And Delivery Ledger before committing post-release evidence.`,
        );
    }

    return path;
}

async function checkReleaseRecord(tag) {
    const path = releaseRecordPath(tag);
    await readFile(new URL(`../${path}`, import.meta.url), "utf8");

    const { stdout } = await execFileAsync(
        "cargo",
        ["run", "-q", "-p", "forma-cli", "--", "workspace", "health", "--json"],
        { cwd: workspaceRoot, maxBuffer: 1024 * 1024, timeout: 120_000 },
    );
    const health = JSON.parse(stdout);
    assertReleaseRecordHasBacklink(health, tag);

    return {
        schemaVersion: 1,
        operation: "release.record-check",
        status: "passed",
        tag,
        path,
    };
}
