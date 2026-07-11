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
    const state = await vscode.commands.executeCommand<{ kind: string; root?: string }>("forma.getRuntimeState");
    assert.ok(
        state && ["ready", "warning"].includes(state.kind),
        `expected a ready Forma workspace, got ${state?.kind}`,
    );
    assert.ok(state.root?.endsWith("/workspace"), `expected discovered fixture workspace, got ${String(state.root)}`);

    const note = (await vscode.workspace.findFiles("note.md", undefined, 1))[0];
    assert.ok(note, "fixture note should be discoverable");
    const noteDocument = await vscode.workspace.openTextDocument(note);
    await vscode.window.showTextDocument(noteDocument);
    const noteText = noteDocument.getText();
    for (const { label, offset, target, minimumLine } of [
        {
            label: "wikilink fragment",
            offset: noteText.indexOf("target#Details") + 1,
            target: "/target.md",
            minimumLine: 1,
        },
        {
            label: "ordinary Markdown link",
            offset: noteText.indexOf("done.md") + 1,
            target: "/done.md",
            minimumLine: 0,
        },
        {
            label: "wikilink embed",
            offset: noteText.lastIndexOf("[[done]]") + 3,
            target: "/done.md",
            minimumLine: 0,
        },
        {
            label: "semantic entryRef",
            offset: noteText.indexOf("owner: done") + "owner: ".length,
            target: "/done.md",
            minimumLine: 0,
        },
    ]) {
        const definitions: vscode.Location[] | undefined = await vscode.commands.executeCommand<vscode.Location[]>(
            "vscode.executeDefinitionProvider",
            note,
            noteDocument.positionAt(offset),
        );
        assert.equal(definitions?.length, 1, label);
        assert.ok(definitions?.[0]?.uri.path.endsWith(target), label);
        assert.ok((definitions?.[0]?.range.start.line ?? -1) >= minimumLine, label);
    }

    const source = (await vscode.workspace.findFiles("done.md", undefined, 1))[0];
    assert.ok(source, "source fixture should be discoverable");
    await vscode.commands.executeCommand("forma.openSource", source);
    assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), source.toString());

    for (const path of [
        ".forma/views/list.md",
        ".forma/views/table.md",
        ".forma/views/kanban.md",
        ".forma/views/graph.md",
    ]) {
        const uri = (await vscode.workspace.findFiles(path, undefined, 1))[0];
        assert.ok(uri, `${path} should be discoverable`);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand("forma.openViewPreviewToSide", uri);
        assert.equal(document.isDirty, false, path);
        assert.ok(document.getText().includes("<!-- forma:content -->"), path);
    }
}
