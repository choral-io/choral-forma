import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";

import { createTestEnvironment, shouldUseShellForCommand } from "./test-environment.mjs";

const vsix = process.env.VSIX_PATH;
if (!vsix) throw new Error("VSIX_PATH must point to the disposable VSIX to validate.");

const extensionRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const expectedIdentity = `${manifest.publisher}.${manifest.name}@${manifest.version}`;
const formaTestBin =
    process.env.FORMA_TEST_BIN ??
    resolve(extensionRoot, "../..", "target/debug", process.platform === "win32" ? "forma.exe" : "forma");
const vscodeExecutablePath =
    process.env.VSCODE_EXECUTABLE_PATH ??
    (await downloadAndUnzipVSCode({
        cachePath: resolve(extensionRoot, ".vscode-test"),
        version: process.env.VSCODE_VERSION ?? "1.110.0",
    }));
const [cli, ...cliPrefixArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath, {
    reuseMachineInstall: true,
});
const scratch = await mkdtemp(join(tmpdir(), "forma-vsix-"));
const userData = join(scratch, "user-data");
const extensions = join(scratch, "extensions");
const installedExtension = join(extensions, `${manifest.publisher}.${manifest.name}-${manifest.version}`);
const extensionTestsPath = fileURLToPath(new URL("../dist/test/installed-runner.cjs", import.meta.url));
const fixture = fileURLToPath(new URL("../test-fixtures/basic", import.meta.url));
const workspace = join(scratch, "workspace");

try {
    await cp(fixture, workspace, { recursive: true });
    await run(cli, [
        ...cliPrefixArgs,
        ...(process.platform === "linux" ? ["--no-sandbox", "--disable-gpu-sandbox"] : []),
        "--user-data-dir",
        userData,
        "--extensions-dir",
        extensions,
        "--install-extension",
        resolve(vsix),
        "--force",
    ]);
    const listed = await run(cli, [
        ...cliPrefixArgs,
        "--user-data-dir",
        userData,
        "--extensions-dir",
        extensions,
        "--list-extensions",
        "--show-versions",
    ]);
    if (!listed.stdout.split(/\r?\n/u).includes(expectedIdentity)) {
        throw new Error(`Installed extension identity was not found. Output: ${listed.stdout.trim()}`);
    }
    await run(vscodeExecutablePath, [
        ...(process.platform === "linux" ? ["--no-sandbox", "--disable-gpu-sandbox"] : []),
        "--disable-updates",
        "--skip-welcome",
        "--skip-release-notes",
        "--no-cached-data",
        "--user-data-dir",
        userData,
        "--extensions-dir",
        extensions,
        "--disable-workspace-trust",
        `--extensionDevelopmentPath=${installedExtension}`,
        `--extensionTestsPath=${extensionTestsPath}`,
        workspace,
    ]);
    console.log(`Disposable VSIX installation and activation verified: ${expectedIdentity}`);
} finally {
    await rm(scratch, { recursive: true, force: true });
}

async function run(command, args) {
    return await new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, {
            env: createTestEnvironment(process.env, { FORMA_TEST_BIN: formaTestBin }),
            shell: shouldUseShellForCommand(command),
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => (stdout += chunk.toString("utf8")));
        child.stderr.on("data", (chunk) => (stderr += chunk.toString("utf8")));
        child.once("error", reject);
        child.once("close", (code) => {
            if (code === 0) resolvePromise({ stdout, stderr });
            else reject(new Error(`${command} exited with ${String(code)}: ${stderr.trim()}`));
        });
    });
}
