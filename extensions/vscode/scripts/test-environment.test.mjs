import assert from "node:assert/strict";
import test from "node:test";

import { createTestEnvironment, shouldUseShellForCommand } from "./test-environment.mjs";

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
