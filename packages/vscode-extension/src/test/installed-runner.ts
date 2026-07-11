import assert from "node:assert/strict";

import * as vscode from "vscode";

export async function run(): Promise<void> {
    const formaTestBin = process.env.FORMA_TEST_BIN;
    assert.ok(formaTestBin, "FORMA_TEST_BIN should identify the locally built Forma binary");
    await vscode.workspace.getConfiguration("forma").update("path", formaTestBin, vscode.ConfigurationTarget.Global);
    const extension = vscode.extensions.getExtension("choral-io.forma");
    assert.ok(extension, "installed Forma for VS Code extension should be discoverable");
    await extension.activate();
    assert.equal(extension.isActive, true);
    await vscode.commands.executeCommand("forma.refreshWorkspace");
    const state = await vscode.commands.executeCommand<{ kind: string }>("forma.getRuntimeState");
    assert.ok(
        state && ["ready", "warning"].includes(state.kind),
        `expected a ready Forma workspace, got ${state?.kind}`,
    );
}
