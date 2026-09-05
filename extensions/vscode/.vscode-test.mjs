import { defineConfig } from "@vscode/test-cli";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { minimumVSCodeVersion } from "./scripts/vscode-compatibility.mjs";
import { installedTestConfiguration, resolveVSCodeVersion } from "./scripts/vscode-installation.mjs";

import {
    createFormaTestEnvironment,
    resolveFormaTestBin,
    writeFormaTestSettings,
} from "./scripts/test-environment.mjs";

const formaTestBin = resolveFormaTestBin(
    process.env,
    resolve(import.meta.dirname, "../..", "target/debug", process.platform === "win32" ? "forma.exe" : "forma"),
);
const env = createFormaTestEnvironment(process.env, formaTestBin);
const userDataDirectory = mkdtempSync(join(tmpdir(), "forma-vscode-"));
process.once("exit", () => rmSync(userDataDirectory, { force: true, recursive: true }));
await writeFormaTestSettings(userDataDirectory, formaTestBin);
const launchArgs = ["--disable-extensions", "--disable-workspace-trust", `--user-data-dir=${userDataDirectory}`];

const stableVersion = await resolveVSCodeVersion("stable");
console.log(`VS Code test targets: minimum ${minimumVSCodeVersion}, stable ${stableVersion}`);

export default defineConfig([
    {
        label: "minimumTrusted",
        env,
        files: "dist/test/extension.test.cjs",
        launchArgs,
        mocha: { ui: "tdd", timeout: 20_000 },
        ...installedTestConfiguration(minimumVSCodeVersion),
        workspaceFolder: "./test-fixtures/basic",
    },
    {
        label: "stableTrusted",
        env,
        files: "dist/test/extension.test.cjs",
        launchArgs,
        mocha: { ui: "tdd", timeout: 20_000 },
        ...installedTestConfiguration(stableVersion),
        workspaceFolder: "./test-fixtures/basic",
    },
]);
