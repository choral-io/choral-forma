import assert from "node:assert/strict";

import * as vscode from "vscode";

import { assertNativeMarkdownLink } from "./link-assertions.ts";

export async function run(): Promise<void> {
    const formaTestBin = process.env.FORMA_TEST_BIN;
    assert.ok(formaTestBin, "FORMA_TEST_BIN should identify the locally built Forma binary");
    await vscode.workspace.getConfiguration("forma").update("path", formaTestBin, vscode.ConfigurationTarget.Global);
    const extension = vscode.extensions.getExtension("choral-io.forma");
    assert.ok(extension, "installed Forma for VS Code extension should be discoverable");
    await extension.activate();
    assert.equal(extension.isActive, true);
    await vscode.commands.executeCommand("forma.refreshWorkspace");
    const state = await vscode.commands.executeCommand<{ kind: string; root?: string; lspState: string }>(
        "forma.getRuntimeState",
    );
    assert.ok(
        state && ["ready", "warning"].includes(state.kind),
        `expected a ready Forma workspace, got ${state?.kind}`,
    );
    assert.ok(state.root?.endsWith("/workspace"), `expected discovered fixture workspace, got ${String(state.root)}`);
    assert.equal(state.lspState, "running", `expected a running Forma LSP, got ${state.lspState}`);

    const note = (await vscode.workspace.findFiles("note.md", undefined, 1))[0];
    assert.ok(note, "fixture note should be discoverable");
    const noteDocument = await vscode.workspace.openTextDocument(note);
    await vscode.window.showTextDocument(noteDocument);
    const noteText = noteDocument.getText();
    await assertNativeMarkdownLink(noteDocument, "done.md", "/done.md");
    const documentLinks = await waitForDocumentLinks(note);
    for (const { label, offset } of [
        { label: "target", offset: noteText.indexOf("[[target|Target page]]") + 3 },
        { label: "Target page", offset: noteText.indexOf("Target page") + 1 },
    ]) {
        const position = noteDocument.positionAt(offset);
        const link = documentLinks.find((candidate) => candidate.range.contains(position));
        assert.ok(
            link,
            `Forma LSP should expose a DocumentLink for ${label}; received ${describeDocumentLinks(
                noteDocument,
                documentLinks,
            )}`,
        );
        assert.ok(link.target?.path.endsWith("/target.md"));
        assert.equal(link.target?.fragment, "");
    }
    const embedPosition = noteDocument.positionAt(noteText.lastIndexOf("[[done]]") + 3);
    const embedLink = documentLinks.find((candidate) => candidate.range.contains(embedPosition));
    assert.ok(embedLink, "Forma LSP should expose a DocumentLink for wikilink embeds");
    assert.ok(embedLink.target?.path.endsWith("/done.md"));
    for (const { label, offset, target, minimumLine } of [
        {
            label: "wikilink fragment",
            offset: noteText.indexOf("target#Details") + 1,
            target: "/target.md",
            minimumLine: 1,
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
        const definitions = await waitForDefinitions(note, noteDocument.positionAt(offset));
        assert.equal(definitions?.length, 1, label);
        const definition = definitions[0];
        assert.ok(definition, label);
        assert.ok(definitionUri(definition).path.endsWith(target), label);
        assert.ok(definitionRange(definition).start.line >= minimumLine, label);
    }

    const tagDefinitions: vscode.Location[] | undefined = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeDefinitionProvider",
        note,
        noteDocument.positionAt(noteText.indexOf("vscode-extension") + 1),
    );
    assert.equal(tagDefinitions?.length ?? 0, 0, "ordinary tags must not become Forma references");

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
        assert.ok(
            !(vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputWebview),
            `${path} source should be active before opening its preview`,
        );
        const existingTabs = new Set(vscode.window.tabGroups.all.flatMap((group) => group.tabs));
        await vscode.commands.executeCommand("forma.openViewPreviewToSide", uri);
        let preview: vscode.Tab | undefined;
        const previewOpened = await waitFor(() => {
            preview = vscode.window.tabGroups.all
                .flatMap((group) => group.tabs)
                .find((tab) => !existingTabs.has(tab) && isNativeMarkdownPreview(tab));
            return preview !== undefined;
        });
        assert.equal(previewOpened, true, `${path} should open the native Markdown Preview tab`);
        assert.ok(preview, `${path} native Markdown Preview tab should be available for cleanup`);
        assert.equal(document.isDirty, false, path);
        assert.ok(document.getText().includes("<!-- forma:content -->"), path);
        assert.equal(await vscode.window.tabGroups.close(preview), true, `${path} preview should close cleanly`);
    }
}

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

async function waitForDocumentLinks(uri: vscode.Uri): Promise<vscode.DocumentLink[]> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
            "vscode.executeLinkProvider",
            uri,
            100,
        );
        if ((links?.length ?? 0) > 1) return links;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return [];
}

function describeDocumentLinks(document: vscode.TextDocument, links: vscode.DocumentLink[]): string {
    return JSON.stringify(
        links.map((link) => ({
            source: document.getText(link.range),
            target: link.target?.toString(),
        })),
    );
}
