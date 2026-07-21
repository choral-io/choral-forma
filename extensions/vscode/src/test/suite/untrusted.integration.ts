import assert from "node:assert/strict";

import * as vscode from "vscode";

suite("Forma for VS Code restricted mode", () => {
    test("blocks managed install and CLI selection without downloading or executing", async () => {
        assert.equal(vscode.workspace.isTrusted, false);
        const sentinel = requiredEnvironment("FORMA_TEST_SENTINEL");
        const invocationMarker = vscode.Uri.file(requiredEnvironment("FORMA_TEST_INVOCATION_MARKER"));
        const managedCliRoot = vscode.Uri.file(requiredEnvironment("FORMA_TEST_MANAGED_CLI_ROOT"));
        await vscode.workspace.getConfiguration("forma").update("path", sentinel, vscode.ConfigurationTarget.Global);
        const extension = vscode.extensions.getExtension("choral-io.forma");
        assert.ok(extension);
        await extension.activate();
        assert.equal(await vscode.commands.executeCommand("forma.installCli"), "restricted");
        assert.equal(await vscode.commands.executeCommand("forma.selectCli"), "restricted");
        const state = await vscode.commands.executeCommand<{ kind: string; lspState: string }>("forma.getRuntimeState");
        assert.equal(state?.kind, "restricted");
        assert.equal(state?.lspState, "stopped");
        assert.equal(await exists(invocationMarker), false, "Restricted Mode must not execute forma.path");
        assert.equal(await exists(managedCliRoot), false, "Restricted Mode must not download a managed CLI");
    });
});

function requiredEnvironment(name: string): string {
    const value = process.env[name];
    assert.ok(value, `${name} should be provided by the Restricted Mode runner`);
    return value;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}
