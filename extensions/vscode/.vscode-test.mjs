import { defineConfig } from "@vscode/test-cli";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

export default defineConfig([
    {
        label: "minimumTrusted",
        env,
        files: "dist/test/extension.test.cjs",
        launchArgs,
        mocha: { ui: "tdd", timeout: 20_000 },
        version: "1.110.0",
        workspaceFolder: "./test-fixtures/basic",
    },
    {
        label: "stableTrusted",
        env,
        files: "dist/test/extension.test.cjs",
        launchArgs,
        mocha: { ui: "tdd", timeout: 20_000 },
        version: "stable",
        workspaceFolder: "./test-fixtures/basic",
    },
]);
