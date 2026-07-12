import type { ReferenceResolveResult } from "@choral-forma/shared";
import * as vscode from "vscode";

import { documentReferenceDiagnostics } from "./document-analysis.ts";
import { frontmatterReferenceValues } from "./frontmatter-links.ts";
import { openSource } from "./preview.ts";
import { referenceTokenAt, scanReferenceTokens, type ReferenceToken } from "./reference-token.ts";
import type { FormaRuntime } from "./runtime.ts";

export function registerNavigation(
    context: vscode.ExtensionContext,
    runtime: FormaRuntime,
    diagnostics: vscode.DiagnosticCollection,
): void {
    const selector: vscode.DocumentSelector = [
        { language: "markdown", scheme: "file" },
        { language: "markdown", scheme: "vscode-remote" },
    ];

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(selector, {
            async provideDefinition(document, position, cancellationToken) {
                const token = await semanticReferenceTokenAt(runtime, document, position, cancellationToken);
                if (!token) return undefined;
                const result = await resolve(runtime, document, token, cancellationToken);
                return result ? resultLocations(runtime, document, result) : undefined;
            },
        }),
        vscode.languages.registerHoverProvider(selector, {
            async provideHover(document, position, cancellationToken) {
                const token = await semanticReferenceTokenAt(runtime, document, position, cancellationToken);
                if (!token) return undefined;
                const result = await resolve(runtime, document, token, cancellationToken);
                if (!result) return undefined;
                const markdown = new vscode.MarkdownString();
                if (result.target) {
                    markdown.appendMarkdown(`**${escapeMarkdown(result.target.title ?? result.target.path)}**  \n`);
                    markdown.appendCodeblock(result.target.path);
                    if (result.target.kind) markdown.appendMarkdown(`Kind: ${escapeMarkdown(result.target.kind)}`);
                } else if ((result.candidates?.length ?? 0) > 0) {
                    markdown.appendMarkdown(
                        `Ambiguous Forma reference: ${String(result.candidates?.length ?? 0)} candidates.`,
                    );
                } else {
                    markdown.appendMarkdown("Unresolved Forma reference.");
                }
                return new vscode.Hover(markdown, tokenRange(document, token));
            },
        }),
        vscode.languages.registerDocumentLinkProvider(selector, {
            provideDocumentLinks(document) {
                return scanReferenceTokens(document.getText())
                    .filter((token) => token.syntax === "wikilink")
                    .map((token) => {
                        const args = encodeURIComponent(JSON.stringify([document.uri.toString(), token]));
                        const link = new vscode.DocumentLink(
                            tokenRange(document, token),
                            vscode.Uri.parse(`command:forma.openReference?${args}`),
                        );
                        link.tooltip = "Open Forma reference";
                        return link;
                    });
            },
        }),
        vscode.commands.registerCommand("forma.openReference", async (documentUri: string, token: ReferenceToken) => {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(documentUri));
            const result = await runtime.resolveReference(document, token.target, token.intent, token.fragment);
            if (!result) return;
            const locations = resultLocations(runtime, document, result);
            if (locations.length === 1) {
                const location = locations[0];
                if (location)
                    await openSource(location.uri, location.range.start.line + 1, location.range.start.character + 1);
            } else if (locations.length > 1) {
                const chosen = await vscode.window.showQuickPick(
                    locations.map((location) => ({ label: vscode.workspace.asRelativePath(location.uri), location })),
                    { placeHolder: "Select a Forma reference target" },
                );
                if (chosen) await openSource(chosen.location.uri);
            } else {
                void vscode.window.showWarningMessage("Forma could not resolve this reference.");
            }
        }),
    );

    const validate = async (document: vscode.TextDocument): Promise<void> => {
        if (!runtime.isFormaDocument(document)) {
            diagnostics.delete(document.uri);
            return;
        }
        try {
            const inspected = await runtime.inspectDocument(document);
            const values = documentReferenceDiagnostics(document.getText(), inspected).map((diagnostic) => {
                const value = new vscode.Diagnostic(
                    new vscode.Range(document.positionAt(diagnostic.start), document.positionAt(diagnostic.end)),
                    diagnostic.message,
                    vscode.DiagnosticSeverity.Warning,
                );
                value.code = diagnostic.code;
                value.source = "Forma";
                return value;
            });
            diagnostics.set(document.uri, values);
        } catch {
            diagnostics.delete(document.uri);
        }
    };
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document) => void validate(document)),
        vscode.workspace.onDidOpenTextDocument((document) => void validate(document)),
        vscode.workspace.onDidDeleteFiles((event) => {
            for (const uri of event.files) diagnostics.delete(uri);
        }),
    );
}

async function semanticReferenceTokenAt(
    runtime: FormaRuntime,
    document: vscode.TextDocument,
    position: vscode.Position,
    cancellationToken: vscode.CancellationToken,
): Promise<ReferenceToken | undefined> {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const bodyToken = referenceTokenAt(text, offset);
    if (bodyToken) return bodyToken;
    const controller = new AbortController();
    const subscription = cancellationToken.onCancellationRequested(() => {
        controller.abort();
    });
    try {
        const inspected = await runtime.inspectDocument(document, controller.signal);
        return referenceTokenAt(text, offset, frontmatterReferenceValues(inspected));
    } catch {
        return undefined;
    } finally {
        subscription.dispose();
    }
}

function resolve(
    runtime: FormaRuntime,
    document: vscode.TextDocument,
    token: ReferenceToken,
    cancellationToken: vscode.CancellationToken,
): Promise<ReferenceResolveResult | undefined> {
    const controller = new AbortController();
    const subscription = cancellationToken.onCancellationRequested(() => {
        controller.abort();
    });
    return runtime
        .resolveReference(document, token.target, token.intent, token.fragment, controller.signal)
        .finally(() => {
            subscription.dispose();
        });
}

function resultLocations(
    runtime: FormaRuntime,
    document: vscode.TextDocument,
    result: ReferenceResolveResult,
): vscode.Location[] {
    const source = runtime.sourcePath(document);
    if (!source) return [];
    if (result.target) {
        if (result.target.fragment && !result.target.fragmentLocation) return [];
        const line = Math.max(0, (result.target.fragmentLocation?.line ?? 1) - 1);
        const column = Math.max(0, (result.target.fragmentLocation?.column ?? 1) - 1);
        const position = new vscode.Position(line, column);
        return [new vscode.Location(runtime.uriFor(source.root, result.target.path), position)];
    }
    return (result.candidates ?? []).map(
        (candidate) => new vscode.Location(runtime.uriFor(source.root, candidate.path), new vscode.Position(0, 0)),
    );
}

function tokenRange(document: vscode.TextDocument, token: ReferenceToken): vscode.Range {
    return new vscode.Range(document.positionAt(token.start), document.positionAt(token.end));
}

function escapeMarkdown(value: string): string {
    return value.replaceAll(/([\\`*_{}[\]()#+\-.!])/gu, "\\$1");
}
