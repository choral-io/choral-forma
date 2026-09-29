// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startPreviewBootstrap, type PreviewFeature } from "./preview-bootstrap.ts";

let stop: (() => void) | undefined;
let frames: Map<number, FrameRequestCallback>;
let nextFrame = 0;
async function flush() {
    await Promise.resolve();
    const scheduled = [...frames.values()];
    frames.clear();
    for (const callback of scheduled) callback(0);
    // Settle lazy module loading and its cleanup without wall-clock sleeps.
    for (let i = 0; i < 5; i++) await Promise.resolve();
}
function feature(selector: string) {
    const destroy = vi.fn();
    const start = vi.fn(() => destroy);
    const load = vi.fn(async () => start);
    return { selector, load, start, destroy };
}
beforeEach(() => {
    frames = new Map();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        frames.set(++nextFrame, callback);
        return nextFrame;
    });
    vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
});
afterEach(() => {
    stop?.();
    stop = undefined;
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it("leaves ordinary Markdown idle and ignores unrelated text and subtree changes", async () => {
    document.body.innerHTML = "<p>Ordinary Markdown</p>";
    const graph = feature("[data-forma-graph-host]");
    stop = startPreviewBootstrap([graph]);
    const query = vi.spyOn(document, "querySelector");
    document.body.append(document.createElement("p"));
    const paragraph = document.body.firstElementChild;
    if (!paragraph) throw new Error("Missing ordinary paragraph");
    paragraph.textContent = "Edited prose";
    await flush();
    expect(graph.load).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
});

it("activates only matching features and cleans up across ordinary/Forma replacements", async () => {
    const graph = feature("[data-forma-graph-host]");
    const temporal = feature("[data-forma-temporal-host]");
    const sticky = feature("[data-forma-sticky-boundary]");
    stop = startPreviewBootstrap([graph, temporal, sticky]);
    document.body.innerHTML = "<section><div data-forma-temporal-host></div></section>";
    await flush();
    expect(temporal.start).toHaveBeenCalledTimes(1);
    expect(graph.load).not.toHaveBeenCalled();
    expect(sticky.load).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("vscode.markdown.updateContent"));
    document.dispatchEvent(new Event("vscode.markdown.updateContent"));
    await flush();
    expect(temporal.start).toHaveBeenCalledTimes(1);
    document.body.innerHTML = "<p>Ordinary again</p>";
    await flush();
    expect(temporal.destroy).toHaveBeenCalledTimes(1);
    document.body.innerHTML = "<div data-forma-temporal-host></div><div data-forma-graph-host></div>";
    await flush();
    expect(temporal.start).toHaveBeenCalledTimes(2);
    expect(graph.start).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("pagehide"));
    stop();
    expect(temporal.destroy).toHaveBeenCalledTimes(2);
    expect(graph.destroy).toHaveBeenCalledTimes(1);
    document.body.innerHTML = "<div data-forma-sticky-boundary></div>";
    window.dispatchEvent(new Event("vscode.markdown.updateContent"));
    await flush();
    expect(sticky.load).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
});

it("does not mount stale async loads after host removal or page disposal", async () => {
    let resolve!: (start: () => () => void) => void;
    const start = vi.fn(() => vi.fn());
    const deferred: PreviewFeature = {
        selector: "[data-forma-graph-host]",
        load: () =>
            new Promise((done) => {
                resolve = done;
            }),
    };
    document.body.innerHTML = "<div data-forma-graph-host></div>";
    stop = startPreviewBootstrap([deferred]);
    document.body.replaceChildren();
    resolve(start);
    await flush();
    expect(start).not.toHaveBeenCalled();
    document.body.innerHTML = "<div data-forma-graph-host></div>";
    await flush();
    stop();
    resolve(start);
    await flush();
    expect(start).not.toHaveBeenCalled();
});

it("coalesces duplicate events while a module is loading and uses the latest DOM", async () => {
    let resolve!: (start: () => () => void) => void;
    const start = vi.fn(() => vi.fn());
    const load = vi.fn(
        () =>
            new Promise<() => () => void>((done) => {
                resolve = done;
            }),
    );
    document.body.innerHTML = "<div data-forma-graph-host></div>";
    stop = startPreviewBootstrap([{ selector: "[data-forma-graph-host]", load }]);
    document.body.innerHTML = "<p>Ordinary</p>";
    await flush();
    document.body.innerHTML = "<div data-forma-graph-host></div>";
    window.dispatchEvent(new Event("vscode.markdown.updateContent"));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    resolve(start);
    await flush();
    expect(start).toHaveBeenCalledTimes(1);
});

it("keeps semantic content intact when enhancement loading fails and can retry", async () => {
    const graph = feature("[data-forma-graph-host]");
    graph.load.mockRejectedValueOnce(new Error("unavailable"));
    document.body.innerHTML = "<div data-forma-graph-host></div><p>Semantic fallback</p>";
    stop = startPreviewBootstrap([graph]);
    await flush();
    expect(document.body.textContent).toContain("Semantic fallback");
    expect(graph.start).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("vscode.markdown.updateContent"));
    await flush();
    expect(graph.start).toHaveBeenCalledTimes(1);
});
