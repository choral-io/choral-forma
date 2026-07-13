import type { ReferenceResolveResult } from "@choral-forma/shared";
import * as vscode from "vscode";

import { retryCancelledCommandAfterGenerationStabilizes } from "./cancelled-command-retry.ts";
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
                    .flatMap((token) => {
                        const args = encodeURIComponent(JSON.stringify([document.uri.toString(), token]));
                        const ranges = [token];
                        if (token.labelStart !== undefined && token.labelEnd !== undefined) {
                            ranges.push({ ...token, start: token.labelStart, end: token.labelEnd });
                        }
                        return ranges.map((rangeToken) => {
                            const link = new vscode.DocumentLink(
                                tokenRange(document, rangeToken),
                                vscode.Uri.parse(`command:forma.openReference?${args}`),
                            );
                            link.tooltip = "Open Forma reference";
                            return link;
                        });
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
            const inspected = await retryCancelledCommandAfterGenerationStabilizes(
                async () => await runtime.inspectDocument(document),
                () => runtime.analysisGeneration,
                () => !document.isClosed && runtime.isFormaDocument(document),
            );
            if (document.isClosed || !runtime.isFormaDocument(document)) {
                diagnostics.delete(document.uri);
                return;
            }
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
    if (bodyToken?.syntax === "wikilink") return bodyToken;
    if (bodyToken?.syntax === "markdown") return undefined;
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
        const start = new vscode.Position(line, column);
        const endLine = Math.max(line, (result.target.fragmentLocation?.endLine ?? line + 1) - 1);
        const endColumn = Math.max(
            endLine === line ? column : 0,
            (result.target.fragmentLocation?.endColumn ?? column + 1) - 1,
        );
        const range = result.target.fragmentLocation
            ? new vscode.Range(start, new vscode.Position(endLine, endColumn))
            : new vscode.Range(start, start);
        return [new vscode.Location(runtime.uriFor(source.root, result.target.path), range)];
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
