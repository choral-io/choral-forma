import * as vscode from "vscode";

export async function openSource(uri: vscode.Uri, line?: number, column?: number): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    if (line !== undefined) {
        const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, (column ?? 1) - 1));
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
}
