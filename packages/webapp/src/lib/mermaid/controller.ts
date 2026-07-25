import { mermaidPolicy, validateMermaidSource, type ValidatedMermaidDiagram } from "./policy";
import {
    mermaidWorkerProtocolVersion,
    type MermaidRenderTheme,
    type MermaidWorkerRequest,
    type MermaidWorkerResponse,
} from "./protocol";

export interface MermaidWorkerLike {
    onerror: ((event: ErrorEvent) => void) | null;
    onmessage: ((event: MessageEvent<MermaidWorkerResponse>) => void) | null;
    postMessage(message: MermaidWorkerRequest): void;
    terminate(): void;
}

export interface MermaidRendererControllerOptions {
    timeoutMs?: number;
    workerFactory?: () => MermaidWorkerLike;
}

export interface MermaidRenderOptions {
    signal?: AbortSignal;
    theme: MermaidRenderTheme;
}

interface RenderTask {
    abortListener?: () => void;
    diagram: ValidatedMermaidDiagram;
    options: MermaidRenderOptions;
    reject: (error: unknown) => void;
    resolve: (svg: string) => void;
    taskId: number;
    timeout?: ReturnType<typeof setTimeout>;
}

const textEncoder = new TextEncoder();

export class MermaidRendererController {
    readonly #queue: RenderTask[] = [];
    readonly #timeoutMs: number;
    readonly #workerFactory: () => MermaidWorkerLike;
    #active?: RenderTask;
    #disposed = false;
    #nextTaskId = 1;
    #worker?: MermaidWorkerLike;

    constructor({
        timeoutMs = mermaidPolicy.worker.timeoutMs,
        workerFactory = createModuleWorker,
    }: MermaidRendererControllerOptions = {}) {
        this.#timeoutMs = timeoutMs;
        this.#workerFactory = workerFactory;
    }

    render(diagram: ValidatedMermaidDiagram, options: MermaidRenderOptions) {
        const validation = validateMermaidSource(diagram.source);
        if (!validation.ok || validation.diagram.model.kind !== diagram.model.kind) {
            return Promise.reject(
                new MermaidRenderError("policy", "Mermaid source no longer matches its validated model."),
            );
        }
        if (this.#disposed) {
            return Promise.reject(new MermaidRenderError("disposed", "Mermaid renderer is disposed."));
        }
        if (options.signal?.aborted) {
            return Promise.reject(abortError());
        }

        return new Promise<string>((resolve, reject) => {
            const task: RenderTask = {
                diagram: validation.diagram,
                options,
                reject,
                resolve,
                taskId: this.#nextTaskId++,
            };
            if (options.signal) {
                task.abortListener = () => {
                    this.#abortTask(task);
                };
                options.signal.addEventListener("abort", task.abortListener, { once: true });
            }
            this.#queue.push(task);
            this.#drain();
        });
    }

    dispose() {
        if (this.#disposed) {
            return;
        }
        this.#disposed = true;
        this.#resetWorker();
        if (this.#active) {
            this.#settle(this.#active, "reject", new MermaidRenderError("disposed", "Mermaid renderer is disposed."));
            this.#active = undefined;
        }
        for (const task of this.#queue.splice(0)) {
            this.#settle(task, "reject", new MermaidRenderError("disposed", "Mermaid renderer is disposed."));
        }
    }

    #abortTask(task: RenderTask) {
        if (this.#active === task) {
            this.#resetWorker();
            this.#active = undefined;
            this.#settle(task, "reject", abortError());
            this.#drain();
            return;
        }
        const index = this.#queue.indexOf(task);
        if (index >= 0) {
            this.#queue.splice(index, 1);
            this.#settle(task, "reject", abortError());
        }
    }

    #drain() {
        if (this.#active || this.#disposed) {
            return;
        }
        const task = this.#queue.shift();
        if (!task) {
            return;
        }
        if (task.options.signal?.aborted) {
            this.#settle(task, "reject", abortError());
            this.#drain();
            return;
        }

        const worker = (this.#worker ??= this.#workerFactory());
        this.#active = task;
        worker.onmessage = (event) => {
            this.#handleResponse(event.data);
        };
        worker.onerror = () => {
            if (this.#active !== task) {
                return;
            }
            this.#resetWorker();
            this.#active = undefined;
            this.#settle(task, "reject", new MermaidRenderError("worker", "Mermaid worker failed."));
            this.#drain();
        };
        task.timeout = setTimeout(() => {
            if (this.#active !== task) {
                return;
            }
            this.#resetWorker();
            this.#active = undefined;
            this.#settle(
                task,
                "reject",
                new MermaidRenderError("timeout", `Mermaid rendering exceeded ${String(this.#timeoutMs)} ms.`),
            );
            this.#drain();
        }, this.#timeoutMs);
        worker.postMessage({
            kind: task.diagram.model.kind,
            maxOutputBytes: mermaidPolicy.output.maxBytes,
            protocolVersion: mermaidWorkerProtocolVersion,
            source: task.diagram.source,
            taskId: task.taskId,
            theme: task.options.theme,
            type: "render",
        });
    }

    #handleResponse(response: MermaidWorkerResponse) {
        const task = this.#active;
        if (response.taskId !== task?.taskId || response.protocolVersion !== mermaidWorkerProtocolVersion) {
            return;
        }
        this.#active = undefined;
        if (response.type === "failed") {
            this.#settle(task, "reject", new MermaidRenderError("worker", response.error));
        } else if (textEncoder.encode(response.svg).byteLength > mermaidPolicy.output.maxBytes) {
            this.#settle(
                task,
                "reject",
                new MermaidRenderError("output", "Mermaid SVG exceeds the client output limit."),
            );
        } else {
            this.#settle(task, "resolve", response.svg);
        }
        this.#drain();
    }

    #resetWorker() {
        if (this.#worker) {
            this.#worker.onmessage = null;
            this.#worker.onerror = null;
            this.#worker.terminate();
            this.#worker = undefined;
        }
    }

    #settle(task: RenderTask, outcome: "reject" | "resolve", value: unknown) {
        if (task.timeout) {
            clearTimeout(task.timeout);
        }
        if (task.abortListener && task.options.signal) {
            task.options.signal.removeEventListener("abort", task.abortListener);
        }
        if (outcome === "resolve") {
            task.resolve(value as string);
        } else {
            task.reject(value);
        }
    }
}

export class MermaidRenderError extends Error {
    readonly code: "disposed" | "output" | "policy" | "timeout" | "worker";

    constructor(code: "disposed" | "output" | "policy" | "timeout" | "worker", message: string) {
        super(message);
        this.code = code;
        this.name = "MermaidRenderError";
    }
}

function createModuleWorker(): MermaidWorkerLike {
    return new Worker(new URL("./worker.ts", import.meta.url), { name: "forma-mermaid-renderer", type: "module" });
}

function abortError() {
    return new DOMException("Mermaid rendering was aborted.", "AbortError");
}
