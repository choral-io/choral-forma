import { defineConfig } from "@vscode/test-cli";
import { resolve } from "node:path";

import { resolveFormaTestBin } from "./scripts/test-environment.mjs";

const formaTestBin = resolveFormaTestBin(
    process.env,
    resolve(import.meta.dirname, "../..", "target/debug", process.platform === "win32" ? "forma.exe" : "forma"),
);
const env = { FORMA_TEST_BIN: formaTestBin };

export default defineConfig([
    {
        label: "minimumTrusted",
        env,
        files: "dist/test/extension.test.cjs",
        launchArgs: ["--disable-extensions", "--disable-workspace-trust"],
        mocha: { ui: "tdd", timeout: 20_000 },
        version: "1.110.0",
        workspaceFolder: "./test-fixtures/basic",
    },
    {
        label: "stableTrusted",
        env,
        files: "dist/test/extension.test.cjs",
        launchArgs: ["--disable-extensions", "--disable-workspace-trust"],
        mocha: { ui: "tdd", timeout: 20_000 },
        version: "stable",
        workspaceFolder: "./test-fixtures/basic",
    },
]);
