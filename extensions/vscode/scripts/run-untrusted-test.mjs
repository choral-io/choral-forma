import { spawn } from "node:child_process";
import { chmod, cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { downloadAndUnzipVSCode } from "@vscode/test-electron";

import { createTestEnvironment } from "./test-environment.mjs";

const extensionRoot = resolve(import.meta.dirname, "..");
const scratch = await mkdtemp(join(tmpdir(), "choral-forma-untrusted-"));
const workspace = join(scratch, "workspace");
const userData = join(scratch, "user-data");
const extensions = join(scratch, "extensions");
const runner = fileURLToPath(new URL("./runner.cjs", import.meta.resolve("@vscode/test-cli")));
const testFile = resolve(extensionRoot, "dist/test/untrusted.test.cjs");
const invocationMarker = join(scratch, "forma-was-executed");
const sentinel = join(scratch, process.platform === "win32" ? "forma-sentinel.cmd" : "forma-sentinel");
const managedCliRoot = join(userData, "User", "globalStorage", "choral-io.forma", "cli");
const formaTestBin = resolve(
    extensionRoot,
    "../..",
    "target/debug",
    process.platform === "win32" ? "forma.exe" : "forma",
);

try {
    await cp(resolve(extensionRoot, "test-fixtures/basic"), workspace, { recursive: true });
    if (process.platform === "win32") {
        await writeFile(sentinel, `@echo off\r\n> "${invocationMarker}" echo invoked\r\n`);
    } else {
        await writeFile(sentinel, `#!/bin/sh\nprintf invoked > '${invocationMarker.replaceAll("'", "'\\''")}'\n`);
        await chmod(sentinel, 0o755);
    }
    const executable =
        process.env.VSCODE_EXECUTABLE_PATH ??
        (await downloadAndUnzipVSCode({
            cachePath: resolve(extensionRoot, ".vscode-test"),
            version: "1.110.0",
        }));
    const options = JSON.stringify({
        colorDefault: true,
        files: [testFile],
        mochaOpts: { timeout: 20_000, ui: "tdd" },
        preload: [],
    });
    const code = await run(
        executable,
        [
            "--no-sandbox",
            "--disable-gpu-sandbox",
            "--disable-updates",
            "--skip-welcome",
            "--skip-release-notes",
            "--no-cached-data",
            "--disable-extensions",
            `--user-data-dir=${userData}`,
            `--extensions-dir=${extensions}`,
            `--extensionDevelopmentPath=${extensionRoot}`,
            `--extensionTestsPath=${runner}`,
            workspace,
        ],
        createTestEnvironment(process.env, {
            FORMA_TEST_BIN: formaTestBin,
            FORMA_TEST_INVOCATION_MARKER: invocationMarker,
            FORMA_TEST_MANAGED_CLI_ROOT: managedCliRoot,
            FORMA_TEST_SENTINEL: sentinel,
            VSCODE_TEST_OPTIONS: options,
        }),
    );
    if (code !== 0) process.exitCode = code;
} finally {
    await rm(scratch, { force: true, recursive: true });
}

async function run(command, args, env) {
    return await new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, { env, stdio: "inherit", windowsHide: true });
        child.once("error", reject);
        child.once("close", (code) => resolvePromise(code ?? 1));
    });
}
