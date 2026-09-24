import assert from "node:assert/strict";

import * as vscode from "vscode";

import { assertNativeMarkdownLink } from "../link-assertions.ts";
import { assertTemporalViewPreview, withCleanViewDiagnostics } from "../view-preview-assertions.ts";

suite("Forma for VS Code extension", () => {
    test("activates in a Forma workspace", async () => {
        const formaTestBin = process.env.FORMA_TEST_BIN;
        assert.ok(formaTestBin, "FORMA_TEST_BIN should identify the locally built Forma binary");
        await vscode.workspace
            .getConfiguration("forma")
            .update("path", formaTestBin, vscode.ConfigurationTarget.Global);
        const extension = vscode.extensions.getExtension("choral-io.forma");
        assert.ok(extension);
        await extension.activate();
        assert.equal(extension.isActive, true);
    });

    test("registers commands, resolves a wikilink, and keeps view source editable", async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes("forma.refreshWorkspace"));
        assert.ok(commands.includes("forma.installCli"));
        assert.ok(commands.includes("forma.selectCli"));
        assert.ok(commands.includes("forma.openCliInstructions"));
        assert.ok(commands.includes("forma.openViewPreviewToSide"));
        assert.ok(!commands.includes("forma.openReference"));

        const note = (await vscode.workspace.findFiles("note.md", undefined, 1))[0];
        assert.ok(note);
        const document = await vscode.workspace.openTextDocument(note);
        await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand("forma.refreshWorkspace");
        const state = await vscode.commands.executeCommand<{ kind: string; lspState: string }>("forma.getRuntimeState");
        assert.ok(state && ["ready", "warning"].includes(state.kind));
        assert.equal(state.lspState, "running");

        const linkPosition = document.positionAt(document.getText().indexOf("target") + 1);
        const definitions = await waitForDefinitions(document.uri, linkPosition);
        assert.equal(definitions?.length, 1);
        const definition = definitions[0];
        assert.ok(definition);
        assert.ok(definitionUri(definition).path.endsWith("/target.md"));
        assert.ok(definitionRange(definition).start.line > 0);
        const documentLinks = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
            "vscode.executeLinkProvider",
            document.uri,
            100,
        );
        for (const { label, offset } of [
            { label: "target", offset: document.getText().indexOf("[[target|Target page]]") + 3 },
            { label: "Target page", offset: document.getText().indexOf("Target page") + 1 },
        ]) {
            const position = document.positionAt(offset);
            const link = documentLinks?.find((candidate) => candidate.range.contains(position));
            assert.ok(link, `Forma LSP should expose a DocumentLink for ${label}`);
            assert.ok(link.target?.path.endsWith("/target.md"));
            assert.equal(link.target?.fragment, "");
        }
        const embedPosition = document.positionAt(document.getText().lastIndexOf("[[done]]") + 3);
        const embedLink = documentLinks?.find((candidate) => candidate.range.contains(embedPosition));
        assert.ok(embedLink, "Forma LSP should expose a DocumentLink for wikilink embeds");
        assert.ok(embedLink.target?.path.endsWith("/done.md"));
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
            "vscode.executeHoverProvider",
            document.uri,
            linkPosition,
        );
        assert.ok((hovers?.length ?? 0) > 0);
        const targetUri = definitionUri(definition);

        await assertNativeMarkdownLink(document, "done.md", "/done.md");

        for (const { label, offset } of [
            { label: "frontmatter entryRef", offset: document.getText().indexOf("owner: done") + "owner: ".length },
            { label: "wikilink embed", offset: document.getText().lastIndexOf("[[done]]") + 3 },
        ]) {
            const resolved = await vscode.commands.executeCommand<DefinitionResult[]>(
                "vscode.executeDefinitionProvider",
                document.uri,
                document.positionAt(offset),
            );
            assert.equal(resolved?.length, 1, label);
            const target = resolved?.[0];
            assert.ok(target, label);
            assert.ok(definitionUri(target).path.endsWith("/done.md"));
        }

        const tagDefinitions = await vscode.commands.executeCommand<vscode.Location[]>(
            "vscode.executeDefinitionProvider",
            document.uri,
            document.positionAt(document.getText().indexOf("vscode-extension") + 1),
        );
        assert.equal(tagDefinitions?.length ?? 0, 0, "ordinary tags must not become Forma references");

        await vscode.commands.executeCommand("forma.openSource", targetUri);
        assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), targetUri.toString());

        await withCleanViewDiagnostics(document, async () => {
            for (const path of [
                ".forma/views/list.md",
                ".forma/views/table.md",
                ".forma/views/kanban.md",
                ".forma/views/graph.md",
                ".forma/views/calendar.md",
                ".forma/views/gantt.md",
            ]) {
                const uri = (await vscode.workspace.findFiles(path, undefined, 1))[0];
                assert.ok(uri, `${path} should be discoverable`);
                const viewDocument = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(viewDocument);
                const existingTabs = new Set(vscode.window.tabGroups.all.flatMap((group) => group.tabs));
                await vscode.commands.executeCommand("forma.openViewPreviewToSide", uri);
                let preview: vscode.Tab | undefined;
                const previewOpened = await waitFor(() => {
                    preview = vscode.window.tabGroups.all
                        .flatMap((group) => group.tabs)
                        .find((tab) => !existingTabs.has(tab) && isNativeMarkdownPreview(tab));
                    return preview !== undefined;
                });
                assert.equal(previewOpened, true, `${path} should open a native Markdown Preview tab`);
                assert.ok(preview, `${path} native Markdown Preview tab should be available for cleanup`);
                assert.equal(viewDocument.isDirty, false, path);
                assert.ok(viewDocument.getText().includes("<!-- forma:content -->"), path);
                if (path.endsWith("/calendar.md")) {
                    assert.ok(viewDocument.getText().includes("mode: calendar"));
                    assert.ok(viewDocument.getText().includes("Extension Calendar"));
                    await assertTemporalViewPreview(viewDocument, "calendar");
                }
                if (path.endsWith("/gantt.md")) {
                    assert.ok(viewDocument.getText().includes("mode: gantt"));
                    assert.ok(viewDocument.getText().includes("Extension Timeline"));
                    await assertTemporalViewPreview(viewDocument, "gantt");
                }
                assert.equal(
                    await vscode.window.tabGroups.close(preview),
                    true,
                    `${path} preview should close cleanly`,
                );
            }
        });

        const folder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(folder);
        const broken = vscode.Uri.joinPath(folder.uri, "broken.md");
        try {
            await vscode.workspace.fs.writeFile(
                broken,
                Buffer.from("---\ntitle: Broken\nstatus: doing\n---\n\n# Broken\n\n[[missing]]\n"),
            );
            await vscode.workspace.openTextDocument(broken);
            const found = await waitFor(() =>
                vscode.languages.getDiagnostics(broken).some((diagnostic) => diagnostic.source === "Forma"),
            );
            assert.equal(found, true);
        } finally {
            await vscode.workspace.fs.delete(broken, { useTrash: false });
        }
    });
});

function isNativeMarkdownPreview(tab: vscode.Tab): boolean {
    const input = tab.input;
    return input instanceof vscode.TabInputWebview && /(?:^|-)markdown\.preview$/u.test(input.viewType);
}

async function waitFor(predicate: () => boolean): Promise<boolean> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
}

type DefinitionResult = vscode.Location | vscode.LocationLink;

function definitionUri(definition: DefinitionResult): vscode.Uri {
    return "targetUri" in definition ? definition.targetUri : definition.uri;
}

function definitionRange(definition: DefinitionResult): vscode.Range {
    return "targetUri" in definition ? (definition.targetSelectionRange ?? definition.targetRange) : definition.range;
}

async function waitForDefinitions(uri: vscode.Uri, position: vscode.Position): Promise<DefinitionResult[]> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const definitions = await vscode.commands.executeCommand<DefinitionResult[]>(
            "vscode.executeDefinitionProvider",
            uri,
            position,
        );
        if ((definitions?.length ?? 0) > 0) return definitions;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return [];
}
