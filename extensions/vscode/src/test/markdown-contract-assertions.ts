import assert from "node:assert/strict";
import * as vscode from "vscode";
import callouts from "../../../../fixtures/forma-validation/samples/markdown/callouts.md";
import images from "../../../../fixtures/forma-validation/samples/markdown/images.md";
import source from "../../../../fixtures/forma-validation/samples/markdown/reader.md";

/** Verify the boundary in the installed host; syntax support belongs to VS Code. */
export async function assertMarkdownReaderContract(): Promise<void> {
    const document = await vscode.workspace.openTextDocument({ language: "markdown", content: source });
    const html = await vscode.commands.executeCommand<string>("markdown.api.render", document);
    assert.ok(html, "native host should render ordinary Markdown");
    assert.ok(html.includes('id="reader-contract"'), "native heading IDs must survive");
    assert.ok(html.includes('href="#section"'), "authored legacy links must survive");
    assert.ok(!html.includes("data-forma-heading-anchor"), "Forma must not inject heading aliases");
    assert.ok(!html.includes('class="forma-frontmatter"'), "unmanaged documents must remain untouched");
    const note = (await vscode.workspace.findFiles("note.md", undefined, 1))[0];
    assert.ok(note);
    const managed = await vscode.workspace.openTextDocument(note);
    await vscode.commands.executeCommand("forma.refreshWorkspace");
    let managedHtml = "";
    for (let attempt = 0; attempt < 40; attempt++) {
        managedHtml = (await vscode.commands.executeCommand<string>("markdown.api.render", managed)) ?? "";
        if (managedHtml.includes('class="forma-wikilink"') && managedHtml.includes('class="forma-frontmatter-link"'))
            break;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(managedHtml.includes('<details class="forma-frontmatter">'), "managed Metadata stays collapsed");
    assert.ok(managedHtml.includes('class="forma-frontmatter-link"'), "metadata references stay navigable");
    assert.ok(managedHtml.includes('class="forma-wikilink"'), "workspace references stay navigable");
    assert.ok(!managedHtml.includes("data-forma-heading-anchor"), "managed headings also remain native");
    const calloutDocument = await vscode.workspace.openTextDocument({ language: "markdown", content: callouts });
    const calloutHtml = await vscode.commands.executeCommand<string>("markdown.api.render", calloutDocument);
    assert.ok(calloutHtml?.includes("说明正文"), "callout body stays readable in the native host");
    assert.ok(!calloutHtml.includes("forma-callout"), "Forma must not render native callouts");
    const imageDocument = await vscode.workspace.openTextDocument({ language: "markdown", content: images });
    const imageHtml = await vscode.commands.executeCommand<string>("markdown.api.render", imageDocument);
    assert.ok(imageHtml);
    assert.equal((imageHtml.match(/<img /gu) ?? []).length, 3);
    assert.ok(!imageHtml.includes("data-reader-image"), "Forma must not wrap native images");
    await vscode.commands.executeCommand("markdown.showPreview", calloutDocument.uri);
    console.log("Forma native Markdown rendering boundary verified");
}
