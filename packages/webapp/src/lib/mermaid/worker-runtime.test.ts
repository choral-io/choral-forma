import { renderMermaidSVG } from "beautiful-mermaid";
import { describe, expect, it, vi } from "vitest";

import { mermaidPolicy, validateMermaidSource } from "./policy";
import { isMermaidWorkerRequest, mermaidWorkerProtocolVersion, type MermaidWorkerRenderRequest } from "./protocol";
import { renderMermaidWorkerRequest } from "./worker-runtime";

describe("renderMermaidWorkerRequest", () => {
    it("rejects stale protocol messages before they reach the runtime", () => {
        expect(isMermaidWorkerRequest({ ...request("flowchart LR\nA --> B"), protocolVersion: 0 })).toBe(false);
    });

    it("rejects protocol messages that try to weaken the output cap or omit theme fields", () => {
        const valid = request("flowchart LR\nA --> B");

        expect(isMermaidWorkerRequest({ ...valid, maxOutputBytes: mermaidPolicy.output.maxBytes + 1 })).toBe(false);
        expect(isMermaidWorkerRequest({ ...valid, theme: { bg: "background" } })).toBe(false);
    });

    it.each([
        ["flowchart", "flowchart LR\nA[Markdown] --> B[Reader]"],
        ["state", 'stateDiagram-v2\nstate "Waiting" as Waiting\nWaiting --> Ready : validate'],
        ["sequence", "sequenceDiagram\nparticipant A as Author\nA->>B: Publish\nNote right of B: Readable"],
        ["class", "classDiagram\nclass Adapter {\n+render() Promise\n}\nAdapter --> Worker : delegates"],
        ["entity relationship", "erDiagram\nENTRY {\nstring path PK\n}\nENTRY ||--o{ LINK : contains"],
    ])("renders the reviewed %s subset synchronously inside the worker runtime", (_, source) => {
        const response = renderMermaidWorkerRequest(request(source), renderMermaidSVG);

        expect(response).toMatchObject({ type: "rendered" });
        if (response.type === "rendered") {
            expect(response.svg).toContain("<svg");
            expect(response.outputBytes).toBeGreaterThan(0);
        }
    });

    it("uses the synchronous renderer only after worker-side policy validation", () => {
        const renderer = vi.fn(() => "<svg/>");
        const response = renderMermaidWorkerRequest(request("flowchart LR\nA --> B"), renderer);

        expect(response).toMatchObject({ outputBytes: 6, type: "rendered" });
        expect(renderer).toHaveBeenCalledOnce();
    });

    it("blocks malformed source before renderer invocation", () => {
        const renderer = vi.fn(() => "<svg/>");
        const response = renderMermaidWorkerRequest(
            { ...request("flowchart LR\nA --> B"), source: "flowchart LR\nA --> B trailing" },
            renderer,
        );

        expect(response).toMatchObject({ type: "failed" });
        expect(renderer).not.toHaveBeenCalled();
    });

    it("enforces the output cap inside the worker", () => {
        const response = renderMermaidWorkerRequest(
            { ...request("flowchart LR\nA --> B"), maxOutputBytes: 5 },
            () => "<svg/>",
        );

        expect(response.type).toBe("failed");
        if (response.type === "failed") {
            expect(response.error).toContain("output limit");
        }
    });

    it("does not let a direct runtime caller raise the Forma output cap", () => {
        const response = renderMermaidWorkerRequest(
            { ...request("flowchart LR\nA --> B"), maxOutputBytes: Number.MAX_SAFE_INTEGER },
            () => "x".repeat(mermaidPolicy.output.maxBytes + 1),
        );

        expect(response).toMatchObject({ type: "failed" });
    });
});

function request(source: string): MermaidWorkerRenderRequest {
    const validation = validateMermaidSource(source);
    if (!validation.ok) {
        throw new Error(validation.diagnostic.message);
    }
    return {
        kind: validation.diagram.model.kind,
        maxOutputBytes: mermaidPolicy.output.maxBytes,
        protocolVersion: mermaidWorkerProtocolVersion,
        source,
        taskId: 1,
        theme: {
            accent: "accent",
            bg: "background",
            border: "border",
            fg: "foreground",
            font: "system-ui",
            surface: "surface",
            transparent: true,
        },
        type: "render",
    };
}
