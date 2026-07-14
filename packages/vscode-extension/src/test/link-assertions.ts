import assert from "node:assert/strict";

import * as vscode from "vscode";

export async function assertNativeMarkdownLink(
    document: vscode.TextDocument,
    sourceTarget: string,
    expectedPathSuffix: string,
): Promise<void> {
    const markdownExtension = vscode.extensions.getExtension("vscode.markdown-language-features");
    assert.ok(markdownExtension, "built-in Markdown extension should be discoverable");
    await markdownExtension.activate();

    const offset = document.getText().indexOf(sourceTarget);
    assert.ok(offset >= 0, `Markdown link target should contain ${sourceTarget}`);
    const position = document.positionAt(offset + 1);
    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
        "vscode.executeLinkProvider",
        document.uri,
        100,
    );
    const link = links?.find((candidate) => candidate.range.contains(position));
    assert.ok(link, "ordinary Markdown link should remain owned by the built-in Markdown extension");
    assert.ok(
        link.target?.path.endsWith(expectedPathSuffix),
        `ordinary Markdown link should target ${expectedPathSuffix}, got ${String(link.target)}`,
    );
}
