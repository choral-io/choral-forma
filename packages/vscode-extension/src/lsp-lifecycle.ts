export type FormaLspRuntimeContext = {
    command: string;
    root: string;
    rootUri: string;
    includePatterns: readonly string[];
    configPatterns: readonly string[];
    configSourcePaths: readonly string[];
};

export type FormaLspClient = {
    start(signal: AbortSignal): Promise<void>;
    stop(): Promise<void>;
    dispose(): Promise<void>;
};

export type FormaLspClientFactory = (context: FormaLspRuntimeContext) => FormaLspClient;

export type FormaLspLifecycleState = "stopped" | "starting" | "running" | "stopping" | "failed";

export type FormaLspLifecycleHooks = {
    onStateChange?: (state: FormaLspLifecycleState, detail?: string) => void;
};

export class FormaLspLifecycle {
    private client: FormaLspClient | undefined;
    private context: FormaLspRuntimeContext | undefined;
    private startController: AbortController | undefined;
    private generation = 0;
    private queue: Promise<void> = Promise.resolve();
    private disposed = false;
    private stateValue: FormaLspLifecycleState = "stopped";

    constructor(
        private readonly createClient: FormaLspClientFactory,
        private readonly hooks: FormaLspLifecycleHooks = {},
    ) {}

    get state(): FormaLspLifecycleState {
        return this.stateValue;
    }

    get activeRoot(): string | undefined {
        return this.context?.root;
    }

    sync(context: FormaLspRuntimeContext | undefined): Promise<void> {
        const generation = ++this.generation;
        this.startController?.abort();
        return this.enqueue(async () => {
            if (!this.isCurrent(generation)) return;
            if (context && this.context && contextKey(context) === contextKey(this.context) && this.client) return;
            await this.stopCurrent();
            if (!context || !this.isCurrent(generation)) return;

            const client = this.createClient(context);
            const controller = new AbortController();
            this.client = client;
            this.context = context;
            this.startController = controller;
            this.setState("starting", context.root);
            try {
                await client.start(controller.signal);
                if (controller.signal.aborted || !this.isCurrent(generation)) {
                    await this.stopCurrent();
                    return;
                }
                this.setState("running", context.root);
            } catch (error) {
                if (controller.signal.aborted || !this.isCurrent(generation)) {
                    await this.stopCurrent();
                    return;
                }
                this.setState("failed", safeError(error));
                await this.stopCurrent(false);
                throw error;
            }
        });
    }

    restart(): Promise<void> {
        const context = this.context;
        if (!context || this.disposed) return Promise.resolve();
        this.context = undefined;
        return this.sync(context);
    }

    stop(): Promise<void> {
        return this.sync(undefined);
    }

    async disposeAsync(): Promise<void> {
        if (this.disposed) {
            await this.queue;
            return;
        }
        this.disposed = true;
        ++this.generation;
        this.startController?.abort();
        await this.enqueue(async () => {
            await this.stopCurrent();
        });
    }

    dispose(): void {
        void this.disposeAsync();
    }

    private enqueue(operation: () => Promise<void>): Promise<void> {
        const result = this.queue.then(operation, operation);
        this.queue = result.catch(() => undefined);
        return result;
    }

    private isCurrent(generation: number): boolean {
        return generation === this.generation && !this.disposed;
    }

    private async stopCurrent(updateState = true): Promise<void> {
        const client = this.client;
        this.client = undefined;
        this.context = undefined;
        this.startController?.abort();
        this.startController = undefined;
        if (!client) {
            if (updateState) this.setState("stopped");
            return;
        }
        if (updateState) this.setState("stopping");
        try {
            await client.stop();
        } finally {
            await client.dispose();
            if (updateState) this.setState("stopped");
        }
    }

    private setState(state: FormaLspLifecycleState, detail?: string): void {
        this.stateValue = state;
        this.hooks.onStateChange?.(state, detail);
    }
}

export function formaLspCommand(context: FormaLspRuntimeContext): {
    command: string;
    args: string[];
    cwd: string;
} {
    return {
        command: context.command,
        args: ["--workspace", context.root, "lsp"],
        cwd: context.root,
    };
}

export function formaLspExecutable(context: FormaLspRuntimeContext): {
    command: string;
    args: string[];
    options: { cwd: string; shell: false; detached: false };
} {
    const command = formaLspCommand(context);
    return {
        command: command.command,
        args: command.args,
        options: { cwd: command.cwd, shell: false, detached: false },
    };
}

export function formaLspDocumentPatterns(context: FormaLspRuntimeContext): string[] {
    return [
        ...new Set(
            [...context.includePatterns, ...context.configPatterns, ...context.configSourcePaths].filter(Boolean),
        ),
    ].sort();
}

export function formaLspDocumentSelector(context: FormaLspRuntimeContext): Array<{
    language: "markdown";
    scheme: string;
    pattern: { baseUri: string; pattern: string };
}> {
    const scheme = new URL(context.rootUri).protocol.slice(0, -1);
    return formaLspDocumentPatterns(context).map((pattern) => ({
        language: "markdown",
        scheme,
        pattern: { baseUri: context.rootUri, pattern },
    }));
}

export function formaLspInitializationOptions(): { clientProfile: "vscode" } {
    return { clientProfile: "vscode" };
}

export class RestartBudget {
    private attempts: number[] = [];

    constructor(
        private readonly maximumRestarts = 3,
        private readonly windowMs = 60_000,
    ) {}

    allow(now = Date.now()): boolean {
        this.attempts = this.attempts.filter((attempt) => now - attempt <= this.windowMs);
        if (this.attempts.length >= this.maximumRestarts) return false;
        this.attempts.push(now);
        return true;
    }
}

function contextKey(context: FormaLspRuntimeContext): string {
    return JSON.stringify([context.command, context.root, context.rootUri, formaLspDocumentPatterns(context)]);
}

function safeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
