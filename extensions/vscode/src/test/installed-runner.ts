import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import * as vscode from "vscode";

import { assertNativeMarkdownLink } from "./link-assertions.ts";

const warmSampleCount = 50;
const warmP95BudgetMs = 100;

export async function run(): Promise<void> {
    const formaTestBin = process.env.FORMA_TEST_BIN;
    assert.ok(formaTestBin, "FORMA_TEST_BIN should identify the locally built Forma binary");
    await vscode.workspace.getConfiguration("forma").update("path", formaTestBin, vscode.ConfigurationTarget.Global);
    const extension = vscode.extensions.getExtension<{ activationMs: number }>("choral-io.forma");
    assert.ok(extension, "installed Forma for VS Code extension should be discoverable");
    const extensionApi = await extension.activate();
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
    const workspaceRoot = state.root;
    assert.ok(workspaceRoot);
    assert.equal(state.lspState, "running", `expected a running Forma LSP, got ${state.lspState}`);

    const note = (await vscode.workspace.findFiles("note.md", undefined, 1))[0];
    assert.ok(note, "fixture note should be discoverable");
    const noteDocument = await vscode.workspace.openTextDocument(note);
    await vscode.window.showTextDocument(noteDocument);
    const noteText = noteDocument.getText();
    const fragmentPosition = noteDocument.positionAt(noteText.indexOf("target#Details") + 1);
    const coldDefinition = await timed(() => waitForDefinitions(note, fragmentPosition));
    assert.equal(coldDefinition.result.length, 1, "cold wikilink fragment Definition");
    const queryWarmDefinition = async (): Promise<void> => {
        const definitions = await vscode.commands.executeCommand<DefinitionResult[]>(
            "vscode.executeDefinitionProvider",
            note,
            fragmentPosition,
        );
        assert.equal(definitions?.length, 1, "warm wikilink fragment Definition");
    };
    const warmDefinition = await measureWarmPerformance(queryWarmDefinition);
    const coldDocumentLink = await timed(() => waitForDocumentLinks(note));
    const documentLinks = coldDocumentLink.result;
    const queryWarmDocumentLink = async (): Promise<void> => {
        const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
            "vscode.executeLinkProvider",
            note,
            100,
        );
        assert.ok((links?.length ?? 0) > 1, "warm Forma DocumentLink request");
    };
    const warmDocumentLink = await measureWarmPerformance(queryWarmDocumentLink);
    const metrics = {
        activationMs: round(extensionApi.activationMs),
        coldDefinitionMs: round(coldDefinition.durationMs),
        warmDefinition: warmDefinition.measurement,
        warmDefinitionAttempts: warmDefinition.attempts,
        coldDocumentLinkMs: round(coldDocumentLink.durationMs),
        warmDocumentLink: warmDocumentLink.measurement,
        warmDocumentLinkAttempts: warmDocumentLink.attempts,
    };
    console.log(JSON.stringify({ kind: "forma-vscode-lsp-metrics", ...metrics }));
    // A single cold request in a shared CI runner is diagnostic evidence, not a
    // statistically meaningful p95. Cold p95 remains a release benchmark over
    // independent editor launches; this smoke test hard-gates the 50-sample
    // warm distributions while still verifying both cold requests functionally.
    // Shared runners can occasionally pause an otherwise healthy extension, so
    // one over-budget distribution is retried. A repeated breach remains a hard
    // failure and deterministic regressions are not hidden.
    assert.ok(warmDefinition.passed, JSON.stringify(metrics));
    assert.ok(warmDocumentLink.passed, JSON.stringify(metrics));
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

    const ambiguousDefinitions = await waitForDefinitions(
        note,
        noteDocument.positionAt(noteText.indexOf("[[same]]") + 3),
    );
    assert.deepEqual(
        ambiguousDefinitions.map((definition) => definitionUri(definition).path).sort(),
        ["/notes/a/same.md", "/notes/b/same.md"].map((suffix) => `${workspaceRoot}${suffix}`).sort(),
        "ambiguous wikilinks should return every candidate",
    );
    const unresolvedDefinitions = await vscode.commands.executeCommand<DefinitionResult[]>(
        "vscode.executeDefinitionProvider",
        note,
        noteDocument.positionAt(noteText.indexOf("[[missing]]") + 3),
    );
    assert.equal(unresolvedDefinitions?.length ?? 0, 0, "unresolved wikilinks must not navigate");

    const unsavedSource = "\nUnsaved overlay: [[done]].\n";
    const unsavedOffset = noteDocument.getText().length + unsavedSource.indexOf("done") + 1;
    const append = new vscode.WorkspaceEdit();
    append.insert(note, noteDocument.positionAt(noteDocument.getText().length), unsavedSource);
    assert.equal(await vscode.workspace.applyEdit(append), true, "unsaved overlay edit should apply");
    assert.equal(noteDocument.isDirty, true, "overlay should remain unsaved while LSP navigation runs");
    const unsavedDefinitions = await waitForDefinitions(note, noteDocument.positionAt(unsavedOffset));
    assert.equal(unsavedDefinitions.length, 1, "unsaved wikilink overlay should resolve");
    const unsavedDefinition = unsavedDefinitions[0];
    assert.ok(unsavedDefinition);
    assert.ok(definitionUri(unsavedDefinition).path.endsWith("/done.md"));
    const restore = new vscode.WorkspaceEdit();
    restore.replace(note, fullDocumentRange(noteDocument), noteText);
    assert.equal(
        await vscode.workspace.applyEdit(restore),
        true,
        "fixture source should restore after overlay validation",
    );
    assert.equal(await noteDocument.save(), true, "restored fixture should save cleanly");

    const tagDefinitions: vscode.Location[] | undefined = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeDefinitionProvider",
        note,
        noteDocument.positionAt(noteText.indexOf("vscode-extension") + 1),
    );
    assert.equal(tagDefinitions?.length ?? 0, 0, "ordinary tags must not become Forma references");
    await assertNativeMarkdownLink(noteDocument, "done.md", "/done.md");

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

async function timed<T>(operation: () => Promise<T>): Promise<{ durationMs: number; result: T }> {
    const started = performance.now();
    const result = await operation();
    return { durationMs: performance.now() - started, result };
}

async function sampleDurations(samples: number, operation: () => Promise<void>): Promise<number[]> {
    const durations: number[] = [];
    for (let index = 0; index < samples; index += 1) {
        durations.push((await timed(operation)).durationMs);
    }
    return durations;
}

type DurationStatistics = {
    minimumMs: number;
    medianMs: number;
    p95Ms: number;
    maximumMs: number;
};

type WarmPerformanceMeasurement = {
    measurement: DurationStatistics;
    attempts: DurationStatistics[];
    passed: boolean;
};

async function measureWarmPerformance(operation: () => Promise<void>): Promise<WarmPerformanceMeasurement> {
    const firstAttempt = statistics(await sampleDurations(warmSampleCount, operation));
    const attempts = [firstAttempt];
    if (firstAttempt.p95Ms > warmP95BudgetMs) {
        attempts.push(statistics(await sampleDurations(warmSampleCount, operation)));
    }
    const measurement = attempts.at(-1);
    if (!measurement) throw new Error("Warm performance measurement did not produce a distribution.");
    return {
        measurement,
        attempts,
        passed: attempts.some(({ p95Ms }) => p95Ms <= warmP95BudgetMs),
    };
}

function statistics(values: number[]): DurationStatistics {
    const sorted = [...values].sort((left, right) => left - right);
    const minimum = sorted[0];
    if (minimum === undefined) throw new Error("Performance statistics require at least one sample.");
    const percentile = (fraction: number): number => {
        const value = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
        if (value === undefined) throw new Error("Performance percentile could not be calculated.");
        return value;
    };
    return {
        minimumMs: round(minimum),
        medianMs: round(percentile(0.5)),
        p95Ms: round(percentile(0.95)),
        maximumMs: round(sorted.at(-1) ?? 0),
    };
}

function round(value: number): number {
    return Number(value.toFixed(3));
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
    return new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
}
