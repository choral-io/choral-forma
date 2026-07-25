import { afterEach, describe, expect, it, vi } from "vitest";

import { MermaidRenderError, MermaidRendererController, type MermaidWorkerLike } from "./controller";
import { mermaidPolicy, validateMermaidSource } from "./policy";
import { mermaidWorkerProtocolVersion, type MermaidWorkerRequest, type MermaidWorkerResponse } from "./protocol";

const theme = {
    accent: "accent",
    bg: "background",
    border: "border",
    fg: "foreground",
    font: "system-ui",
    surface: "surface",
    transparent: true,
};

describe("MermaidRendererController", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("runs one worker task at a time", async () => {
        const worker = new FakeWorker();
        const controller = new MermaidRendererController({ workerFactory: () => worker });
        const first = controller.render(validated("flowchart LR\nA --> B"), { theme });
        const second = controller.render(validated("flowchart LR\nC --> D"), { theme });

        expect(worker.requests).toHaveLength(1);
        worker.succeed(0, "<svg/>");
        await expect(first).resolves.toBe("<svg/>");
        expect(worker.requests).toHaveLength(2);
        worker.succeed(1, "<svg/>");
        await expect(second).resolves.toBe("<svg/>");

        controller.dispose();
    });

    it("terminates and recreates the worker after a real timeout", async () => {
        vi.useFakeTimers();
        const workers: FakeWorker[] = [];
        const controller = new MermaidRendererController({
            timeoutMs: 25,
            workerFactory: () => {
                const worker = new FakeWorker();
                workers.push(worker);
                return worker;
            },
        });
        const first = controller.render(validated("flowchart LR\nA --> B"), { theme });
        const second = controller.render(validated("flowchart LR\nC --> D"), { theme });
        const firstRejection = expect(first).rejects.toMatchObject({ code: "timeout" });

        await vi.advanceTimersByTimeAsync(25);
        await firstRejection;
        expect(workers[0]?.terminated).toBe(true);
        expect(workers).toHaveLength(2);
        workers[1]?.succeed(0, "<svg/>");
        await expect(second).resolves.toBe("<svg/>");

        controller.dispose();
    });

    it("terminates the active worker on abort while preserving queued work", async () => {
        const workers: FakeWorker[] = [];
        const controller = new MermaidRendererController({
            workerFactory: () => {
                const worker = new FakeWorker();
                workers.push(worker);
                return worker;
            },
        });
        const abortController = new AbortController();
        const first = controller.render(validated("flowchart LR\nA --> B"), { signal: abortController.signal, theme });
        const second = controller.render(validated("flowchart LR\nC --> D"), { theme });

        abortController.abort();
        await expect(first).rejects.toMatchObject({ name: "AbortError" });
        expect(workers[0]?.terminated).toBe(true);
        expect(workers).toHaveLength(2);
        workers[1]?.succeed(0, "<svg/>");
        await expect(second).resolves.toBe("<svg/>");

        controller.dispose();
    });

    it("rejects forged policy models and oversized client output", async () => {
        const worker = new FakeWorker();
        const controller = new MermaidRendererController({ workerFactory: () => worker });
        const diagram = validated("flowchart LR\nA --> B");
        const forged = { ...diagram, source: "flowchart LR\nA --> B trailing" };

        await expect(controller.render(forged, { theme })).rejects.toMatchObject({ code: "policy" });

        const render = controller.render(diagram, { theme });
        worker.respond({
            outputBytes: mermaidPolicy.output.maxBytes + 1,
            protocolVersion: mermaidWorkerProtocolVersion,
            svg: "x".repeat(mermaidPolicy.output.maxBytes + 1),
            taskId: worker.requests[0]?.taskId ?? 0,
            type: "rendered",
        });
        await expect(render).rejects.toMatchObject({ code: "output" });

        controller.dispose();
    });

    it("rejects worker failures without poisoning later work", async () => {
        const worker = new FakeWorker();
        const controller = new MermaidRendererController({ workerFactory: () => worker });
        const first = controller.render(validated("flowchart LR\nA --> B"), { theme });
        const second = controller.render(validated("flowchart LR\nC --> D"), { theme });

        worker.fail(0, "invalid");
        await expect(first).rejects.toEqual(new MermaidRenderError("worker", "invalid"));
        worker.succeed(1, "<svg/>");
        await expect(second).resolves.toBe("<svg/>");

        controller.dispose();
    });
});

class FakeWorker implements MermaidWorkerLike {
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessage: ((event: MessageEvent<MermaidWorkerResponse>) => void) | null = null;
    readonly requests: MermaidWorkerRequest[] = [];
    terminated = false;

    postMessage(message: MermaidWorkerRequest) {
        this.requests.push(message);
    }

    terminate() {
        this.terminated = true;
    }

    respond(response: MermaidWorkerResponse) {
        this.onmessage?.(new MessageEvent("message", { data: response }));
    }

    succeed(index: number, svg: string) {
        const request = this.requests[index];
        if (!request) {
            throw new Error(`Missing request ${String(index)}.`);
        }
        this.respond({
            outputBytes: new TextEncoder().encode(svg).byteLength,
            protocolVersion: mermaidWorkerProtocolVersion,
            svg,
            taskId: request.taskId,
            type: "rendered",
        });
    }

    fail(index: number, error: string) {
        const request = this.requests[index];
        if (!request) {
            throw new Error(`Missing request ${String(index)}.`);
        }
        this.respond({
            error,
            protocolVersion: mermaidWorkerProtocolVersion,
            taskId: request.taskId,
            type: "failed",
        });
    }
}

function validated(source: string) {
    const result = validateMermaidSource(source);
    if (!result.ok) {
        throw new Error(result.diagnostic.message);
    }
    return result.diagram;
}
