/// <reference lib="webworker" />

import { isMermaidWorkerRequest, mermaidWorkerProtocolVersion, type MermaidWorkerResponse } from "./protocol";
import { renderMermaidSvg } from "./renderer";
import { renderMermaidWorkerRequest } from "./worker-runtime";

const worker = self as DedicatedWorkerGlobalScope;
worker.addEventListener("message", (event: MessageEvent<unknown>) => {
    handleMessage(event.data);
});

function handleMessage(message: unknown) {
    let response: MermaidWorkerResponse;
    if (!isMermaidWorkerRequest(message)) {
        response = failure(0, "Invalid or unsupported Mermaid worker request.");
    } else {
        try {
            response = renderMermaidWorkerRequest(message, renderMermaidSvg);
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
