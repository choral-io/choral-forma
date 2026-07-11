import assert from "node:assert/strict";

import * as vscode from "vscode";

suite("Forma for VS Code restricted mode", () => {
    test("activates safe UI without executing Forma operations", async () => {
        assert.equal(vscode.workspace.isTrusted, false);
        const extension = vscode.extensions.getExtension("choral-io.forma");
        assert.ok(extension);
        await extension.activate();
        const state = await vscode.commands.executeCommand<{ kind: string }>("forma.getRuntimeState");
        assert.equal(state?.kind, "restricted");
    });
});
