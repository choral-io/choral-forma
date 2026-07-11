import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vsix = process.env.VSIX_PATH;
if (!vsix) throw new Error("VSIX_PATH must point to the disposable VSIX to validate.");

const defaultCode =
    process.platform === "darwin"
        ? "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
        : process.platform === "win32"
          ? "code.cmd"
          : "code";
const code = process.env.CODE_BIN ?? defaultCode;
const scratch = await mkdtemp(join(tmpdir(), "forma-vsix-"));
const userData = join(scratch, "user-data");
const extensions = join(scratch, "extensions");
const extensionTestsPath = fileURLToPath(new URL("../dist/test/installed-runner.cjs", import.meta.url));
const workspace = fileURLToPath(new URL("../test-fixtures/basic", import.meta.url));

try {
    await run(code, [
        "--user-data-dir",
        userData,
        "--extensions-dir",
        extensions,
        "--install-extension",
        resolve(vsix),
        "--force",
    ]);
    const listed = await run(code, [
        "--user-data-dir",
        userData,
        "--extensions-dir",
        extensions,
        "--list-extensions",
        "--show-versions",
    ]);
    if (!listed.stdout.split(/\r?\n/u).includes("choral-io.forma@0.1.0-alpha.13")) {
        throw new Error(`Installed extension identity was not found. Output: ${listed.stdout.trim()}`);
    }
    await run(code, [
        "--user-data-dir",
        userData,
        "--extensions-dir",
        extensions,
        "--disable-workspace-trust",
        `--extensionTestsPath=${extensionTestsPath}`,
        workspace,
    ]);
    console.log("Disposable VSIX installation and activation verified: choral-io.forma@0.1.0-alpha.13");
} finally {
    await rm(scratch, { recursive: true, force: true });
}

async function run(command, args) {
    return await new Promise((resolvePromise, reject) => {
        const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
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
