import assert from "node:assert/strict";

import * as vscode from "vscode";

export async function assertTemporalViewPreview(
    document: vscode.TextDocument,
    mode: "calendar" | "gantt",
): Promise<void> {
    const html = await vscode.commands.executeCommand<string>("markdown.api.render", document);
    assert.equal(typeof html, "string", `${mode} preview should render through the built-in Markdown engine`);
    assert.ok(html, `${mode} preview HTML should be available`);

    assert.ok(
        html.includes("data-forma-temporal-host"),
        `${mode} preview should include its interactive mount; HTML: ${html.slice(-2400)}`,
    );
    assert.ok(html.includes("data-forma-temporal-fallback"), `${mode} preview should preserve its semantic fallback`);
    assert.ok(html.includes('type="application/json"'), `${mode} preview should include inert projection data`);

    if (mode === "calendar") {
        assert.ok(
            html.includes('aria-label="Calendar agenda"'),
            `Calendar preview should contain its agenda; rendered HTML: ${html.slice(-1200)}`,
        );
    } else {
        assert.ok(
            html.includes('aria-label="Gantt complete list"'),
            `Gantt preview should contain its complete list; rendered HTML: ${html.slice(-1200)}`,
        );
        assert.ok(html.includes("50% complete"), "Gantt preview should expose authored progress");
    }

    assert.ok(html.includes('data-open-source="done.md"'), `${mode} preview should link to the predecessor source`);
    assert.ok(html.includes('data-open-source="note.md"'), `${mode} preview should link to the successor source`);
}

export async function withCleanViewDiagnostics<T>(
    document: vscode.TextDocument,
    operation: () => Promise<T>,
): Promise<T> {
    const original = document.getText();
    const clean = original.replaceAll("[[same]]", "same").replaceAll("[[missing]]", "missing");
    assert.notEqual(clean, original, "fixture should contain the intentional ambiguous and unresolved references");

    let result!: T;
    let failed = false;
    let operationError: unknown;
    try {
        await replaceDocumentText(document, clean);
        assert.equal(await document.save(), true, "sanitized fixture note should save");
        await vscode.commands.executeCommand("forma.refreshWorkspace");
        result = await operation();
    } catch (error) {
        failed = true;
        operationError = error;
    }
    try {
        if (document.getText() !== original) {
            await replaceDocumentText(document, original);
            assert.equal(await document.save(), true, "fixture note should be restored");
            await vscode.commands.executeCommand("forma.refreshWorkspace");
        }
    } catch (cleanupError) {
        if (failed) {
            throw new AggregateError(
                [operationError, cleanupError],
                `View assertion failed: ${operationError instanceof Error ? operationError.message : "non-Error failure"}; fixture restoration also failed`,
                { cause: cleanupError },
            );
        }
        throw cleanupError;
    }
    if (failed) throw operationError;
    return result;
}

async function replaceDocumentText(document: vscode.TextDocument, text: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
        document.uri,
        new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length)),
        text,
    );
    assert.equal(await vscode.workspace.applyEdit(edit), true, "fixture note edit should apply");
}
