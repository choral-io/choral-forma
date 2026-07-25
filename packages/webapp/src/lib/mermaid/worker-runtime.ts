import { mermaidPolicy, validateMermaidSource } from "./policy";
import {
    mermaidWorkerProtocolVersion,
    type MermaidWorkerRenderFailure,
    type MermaidWorkerRenderRequest,
    type MermaidWorkerResponse,
} from "./protocol";

const textEncoder = new TextEncoder();

export type MermaidSynchronousRenderer = (source: string, options: MermaidWorkerRenderRequest["theme"]) => string;

export function renderMermaidWorkerRequest(
    request: MermaidWorkerRenderRequest,
    renderer: MermaidSynchronousRenderer,
): MermaidWorkerResponse {
    try {
        const validation = validateMermaidSource(request.source);
        if (!validation.ok || validation.diagram.model.kind !== request.kind) {
            throw new Error(
                validation.ok ? "Mermaid diagram kind does not match validated source." : validation.diagnostic.message,
            );
        }

        const svg = renderer(request.source, request.theme);
        const outputBytes = textEncoder.encode(svg).byteLength;
        const outputLimit = Math.min(request.maxOutputBytes, mermaidPolicy.output.maxBytes);
        if (outputBytes > outputLimit) {
            throw new Error(`Mermaid SVG exceeds the ${String(outputLimit)} byte output limit.`);
        }
        return {
            outputBytes,
            protocolVersion: mermaidWorkerProtocolVersion,
            svg,
            taskId: request.taskId,
            type: "rendered",
        };
    } catch (error: unknown) {
        return failure(request, error instanceof Error ? error.message : "Unknown Mermaid worker error.");
    }
}

function failure(request: MermaidWorkerRenderRequest, error: string): MermaidWorkerRenderFailure {
    return {
        error,
        protocolVersion: mermaidWorkerProtocolVersion,
        taskId: request.taskId,
        type: "failed",
    };
}
