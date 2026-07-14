import * as vscode from "vscode";
import {
    CloseAction,
    ErrorAction,
    LanguageClient,
    RevealOutputChannelOn,
    State,
    type DocumentSelector,
    type ErrorHandler,
    type LanguageClientOptions,
    type ServerOptions,
} from "vscode-languageclient/node";

import {
    FormaLspLifecycle,
    RestartBudget,
    formaLspDocumentSelector,
    formaLspExecutable,
    formaLspInitializationOptions,
    type FormaLspClient,
    type FormaLspRuntimeContext,
} from "./lsp-lifecycle.ts";
import { editorUriToProtocol, protocolUriToEditor } from "./lsp-uri.ts";

export function createFormaLspLifecycle(output: vscode.LogOutputChannel): FormaLspLifecycle {
    return new FormaLspLifecycle((context) => createFormaLanguageClient(context, output), {
        onStateChange: (state, detail) => {
            output.debug(`[lsp] lifecycle=${state}${detail ? ` detail=${JSON.stringify(detail)}` : ""}`);
        },
    });
}

function createFormaLanguageClient(context: FormaLspRuntimeContext, output: vscode.LogOutputChannel): FormaLspClient {
    const executable = formaLspExecutable(context);
    const rootUri = vscode.Uri.parse(context.rootUri);
    const containingFolder = vscode.workspace.getWorkspaceFolder(rootUri);
    const workspaceFolder: vscode.WorkspaceFolder = {
        uri: rootUri,
        name: vscode.workspace.asRelativePath(rootUri, false),
        index: containingFolder?.index ?? 0,
    };
    const documentSelector: DocumentSelector = formaLspDocumentSelector(context);
    const restartBudget = new RestartBudget(3, 60_000);
    const errorHandler: ErrorHandler = {
        error(error, _message, count) {
            const detail = boundedError(error);
            if ((count ?? 1) > 3) {
                output.error(`[lsp] transport errors exceeded the retry bound: ${detail}`);
                return { action: ErrorAction.Shutdown, handled: true };
            }
            output.warn(`[lsp] transport error ${String(count ?? 1)}/3: ${detail}`);
            return { action: ErrorAction.Continue, handled: true };
        },
        closed() {
            if (restartBudget.allow()) {
                output.warn("[lsp] server exited unexpectedly; restarting within the bounded policy.");
                return { action: CloseAction.Restart, handled: true };
            }
            output.error("[lsp] server repeatedly exited; automatic restart is now stopped.");
            return { action: CloseAction.DoNotRestart, handled: true };
        },
    };
    const serverOptions: ServerOptions = {
        ...executable,
        // Executables use stdio by default. Declaring TransportKind.stdio makes
        // vscode-languageclient append a CLI-specific `--stdio` argument.
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector,
        workspaceFolder,
        initializationOptions: formaLspInitializationOptions(),
        outputChannel: output,
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        errorHandler,
        connectionOptions: { maxRestartCount: 3 },
        uriConverters: {
            code2Protocol: (uri) => editorUriToProtocol(uri.toString(), context.rootUri),
            protocol2Code: (uri) => vscode.Uri.parse(protocolUriToEditor(uri, context.rootUri)),
        },
    };
    return new LanguageClientAdapter(
        new LanguageClient("forma", "Forma Language Server", serverOptions, clientOptions),
        output,
    );
}

class LanguageClientAdapter implements FormaLspClient {
    private readonly stateSubscription: vscode.Disposable;
    private disposed = false;

    constructor(
        private readonly client: LanguageClient,
        private readonly output: vscode.LogOutputChannel,
    ) {
        this.stateSubscription = client.onDidChangeState(({ oldState, newState }) => {
            output.debug(`[lsp] state=${stateName(oldState)}->${stateName(newState)}`);
        });
    }

    async start(signal: AbortSignal): Promise<void> {
        if (isAborted(signal)) return;
        const abort = (): void => {
            void this.client.stop().catch(() => undefined);
        };
        signal.addEventListener("abort", abort, { once: true });
        try {
            await this.client.start();
            if (isAborted(signal)) await this.client.stop();
        } finally {
            signal.removeEventListener("abort", abort);
        }
    }

    async stop(): Promise<void> {
        if (!this.client.needsStop()) return;
        try {
            await this.client.stop();
        } catch (error) {
            if (this.client.needsStop()) throw error;
            this.output.debug(`[lsp] ignored stop race after the client settled: ${boundedError(error)}`);
        }
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        this.stateSubscription.dispose();
        try {
            await this.client.dispose();
        } catch (error) {
            this.output.debug(`[lsp] client disposal completed after a failed start: ${boundedError(error)}`);
        }
    }
}

function stateName(state: State): string {
    return State[state];
}

function boundedError(error: unknown): string {
    return (error instanceof Error ? error.message : String(error)).replaceAll(/\s+/gu, " ").slice(0, 2_000);
}

function isAborted(signal: AbortSignal): boolean {
    return signal.aborted;
}
