import assert from "node:assert/strict";
import * as vscode from "vscode";

/** Exercises automatic config watching with one document kept open throughout. */
export async function assertPreviewScopeChanges(root: vscode.Uri): Promise<void> {
    const config = vscode.Uri.joinPath(root, ".forma/spaces/notes.md");
    const original = await vscode.workspace.fs.readFile(config);
    const text = new TextDecoder().decode(original);
    const narrowed = text.replace('- "*.md"', '- "note.md"');
    assert.notEqual(narrowed, text, "scope fixture must have the root Markdown inclusion rule");
    const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(root, "target.md"));
    await expectMetadata(document, true);
    try {
        await vscode.workspace.fs.writeFile(config, new TextEncoder().encode(narrowed));
        await expectMetadata(document, false);
        await vscode.workspace.fs.writeFile(config, original);
        await expectMetadata(document, true);
    } finally {
        await vscode.workspace.fs.writeFile(config, original);
    }
}

async function expectMetadata(document: vscode.TextDocument, present: boolean): Promise<void> {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        const html = await vscode.commands.executeCommand<string>("markdown.api.render", document);
        if (html?.includes('class="forma-frontmatter"') === present) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail(`Metadata enhancement should become ${present ? "present" : "absent"} after scope refresh`);
}
