import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    createFormaTestEnvironment,
    createTestEnvironment,
    resolveFormaTestBin,
    shouldUseShellForCommand,
    writeFormaTestSettings,
} from "./test-environment.mjs";

test("omits ELECTRON_RUN_AS_NODE from the environment passed to VS Code", () => {
    const environment = createTestEnvironment(
        { ELECTRON_RUN_AS_NODE: "1", PATH: "/usr/bin" },
        { FORMA_TEST_BIN: "/tmp/forma", VSCODE_TEST_OPTIONS: "{}" },
    );

    assert.deepEqual(environment, {
        FORMA_TEST_BIN: "/tmp/forma",
        PATH: "/usr/bin",
        VSCODE_TEST_OPTIONS: "{}",
    });
    assert.equal("ELECTRON_RUN_AS_NODE" in environment, false);
});

test("uses a shell only for Windows command launchers", () => {
    assert.equal(shouldUseShellForCommand("C:\\VSCode\\bin\\code.cmd", "win32"), true);
    assert.equal(shouldUseShellForCommand("C:\\VSCode\\Code.exe", "win32"), false);
    assert.equal(
        shouldUseShellForCommand("/Applications/Visual Studio Code.app/Contents/MacOS/Electron", "darwin"),
        false,
    );
    assert.equal(shouldUseShellForCommand("/usr/bin/code", "linux"), false);
});

test("prefers an explicit Forma test binary over the checkout target fallback", () => {
    assert.equal(
        resolveFormaTestBin({ FORMA_TEST_BIN: "/tmp/exact/forma" }, "/workspace/target/debug/forma"),
        "/tmp/exact/forma",
    );
    assert.equal(resolveFormaTestBin({}, "/workspace/target/debug/forma"), "/workspace/target/debug/forma");
});

test("puts the exact Forma test binary first on the extension host PATH", () => {
    assert.deepEqual(
        createFormaTestEnvironment(
            { ELECTRON_RUN_AS_NODE: "1", PATH: "/usr/bin" },
            "/tmp/exact/forma",
            { VSCODE_TEST_OPTIONS: "{}" },
            ":",
        ),
        {
            FORMA_TEST_BIN: "/tmp/exact/forma",
            PATH: "/tmp/exact:/usr/bin",
            VSCODE_TEST_OPTIONS: "{}",
        },
    );
});

test("writes the exact Forma path before VS Code autoactivation", async () => {
    const userData = await mkdtemp(join(tmpdir(), "forma-test-settings-"));
    try {
        const settingsPath = await writeFormaTestSettings(userData, "/tmp/exact/forma");
        assert.equal(settingsPath, join(userData, "User", "settings.json"));
        assert.deepEqual(JSON.parse(await readFile(settingsPath, "utf8")), { "forma.path": "/tmp/exact/forma" });
    } finally {
        await rm(userData, { force: true, recursive: true });
    }
});
