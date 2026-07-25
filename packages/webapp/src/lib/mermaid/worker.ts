/// <reference lib="webworker" />

import { isMermaidWorkerRequest, mermaidWorkerProtocolVersion, type MermaidWorkerResponse } from "./protocol";
import { renderMermaidWorkerRequest } from "./worker-runtime";

const worker = self as DedicatedWorkerGlobalScope;
const workerEnvironment = globalThis as unknown as Record<string, unknown>;

// beautiful-mermaid's synchronous ELK adapter expects elkjs to expose its
// in-process FakeWorker. In a real DedicatedWorker, elkjs otherwise mistakes
// the current worker for its own layout worker and exports no constructor.
// These Worker-local shims select the DOM/CommonJS branch and let the adapter
// restore `self` without writing to WorkerGlobalScope's getter-only property.
// They do not add a DOM implementation or expose anything to the host page.
Object.defineProperty(globalThis, "self", {
    configurable: true,
    value: globalThis,
    writable: true,
});
workerEnvironment.document ??= {};
const rendererPromise = import("beautiful-mermaid").then(({ renderMermaidSVG }) => renderMermaidSVG);

worker.addEventListener("message", (event: MessageEvent<unknown>) => {
    void handleMessage(event.data);
});

async function handleMessage(message: unknown) {
    let response: MermaidWorkerResponse;
    if (!isMermaidWorkerRequest(message)) {
        response = failure(0, "Invalid or unsupported Mermaid worker request.");
    } else {
        try {
            response = renderMermaidWorkerRequest(message, await rendererPromise);
        } catch (error: unknown) {
            response = failure(
                message.taskId,
                error instanceof Error ? error.message : "Mermaid worker failed to load.",
            );
        }
    }
    worker.postMessage(response);
}

function failure(taskId: number, error: string): MermaidWorkerResponse {
    return {
        error,
        protocolVersion: mermaidWorkerProtocolVersion,
        taskId,
        type: "failed",
    };
}
