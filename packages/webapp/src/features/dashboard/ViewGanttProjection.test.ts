// @vitest-environment jsdom

import type { DashboardViewProjection } from "@/data/workspace-client";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ViewGanttProjection } from "./ViewGanttProjection";

type Projection = Extract<DashboardViewProjection, { kind: "gantt" }>;
let root: Root;
let host: HTMLDivElement;

async function flush(action: () => void) {
    await act(async () => {
        action();
        await Promise.resolve();
    });
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe = vi.fn();
            disconnect = vi.fn();
        },
    );
    // Only exercise state/DOM coordination here. Real geometry is verified in-browser.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
        return Number.parseFloat(this.style.width) || 800;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
        return Number.parseFloat(this.style.height) || 400;
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => {
    await flush(() => {
        root.unmount();
    });
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function fixture(): Projection {
    return {
        kind: "gantt",
        timeZone: "UTC",
        routes: {},
        counts: { candidates: 1, scheduled: 1, unscheduled: 0, invalid: 0 },
        nodes: [
            {
                path: "a.md",
                title: "An exhibition",
                status: "scheduled",
                dependencies: {
                    declared: 0,
                    predecessors: [],
                    outsideSelection: 0,
                    unresolved: 0,
                    duplicates: 0,
                    selfReferences: 0,
                },
            },
        ],
        rows: [
            {
                path: "a.md",
                firstDate: "2026-01-01",
                afterLastDate: "2027-01-01",
                milestone: false,
                temporal: { kind: "date", start: "2026-01-01", endExclusive: "2027-01-01" },
            },
        ],
        edges: [],
    };
}
async function render(projection = fixture()) {
    await flush(() => {
        root.render(createElement(MemoryRouter, null, createElement(ViewGanttProjection, { projection })));
    });
}
function element<K extends keyof HTMLElementTagNameMap>(selector: K): HTMLElementTagNameMap[K];
function element(selector: string): HTMLElement;
function element(selector: string): HTMLElement {
    const found = host.querySelector<HTMLElement>(selector);
    if (!found) throw new Error(`Missing ${selector}`);
    return found;
}
async function submit(value: string) {
    element("input").value = value;
    await flush(() => {
        element("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
}
function origin() {
    return element('[role="grid"] > div').style.getPropertyValue("--gantt-origin");
}

it("Today discards an unsubmitted draft without replacing the native input", async () => {
    await render();
    const input = element("input");
    const today = input.value;
    const button = [...host.querySelectorAll("button")].find((button) => button.textContent === "Today");
    if (!button) throw new Error("Missing Today");
    await flush(() => {
        button.click();
    });
    input.value = "2027-03-02";
    await flush(() => {
        button.click();
    });
    expect(input.value).toBe(today);
    expect(element('input[name="date"]')).toBe(input);
});

it("consumes same-range jumps so later left-edge extension still works", async () => {
    await render();
    const before = Number(origin());
    await submit("2026-06-15");
    expect(Number(origin())).toBe(before);
    const grid = element('[role="grid"]');
    await flush(() => {
        grid.dispatchEvent(new Event("scroll"));
    });
    await flush(() => {
        grid.scrollLeft = 1;
        grid.dispatchEvent(new Event("scroll"));
    });
    expect(Number(origin())).toBe(before - 90);
    expect(grid.scrollLeft).toBe(1 + 90 * 28);
});

it("vertical scrolling at the left edge does not mutate the date range", async () => {
    await render();
    const before = origin();
    const grid = element('[role="grid"]');
    await flush(() => {
        grid.scrollTop = 80;
        grid.dispatchEvent(new Event("scroll"));
    });
    expect(origin()).toBe(before);
    expect(grid.scrollLeft).toBe(0);
});

it("rejects invalid and oversized date jumps atomically", async () => {
    await render();
    await submit("2026-06-15");
    const grid = element('[role="grid"]');
    const before = { origin: origin(), left: grid.scrollLeft };
    for (const value of ["", "9999-12-31", "9000-01-01"]) {
        await submit(value);
        expect(element("input").value).toBe("2026-06-15");
        expect({ origin: origin(), left: grid.scrollLeft }).toEqual(before);
        expect(element('[role="status"]').textContent).not.toBe("");
    }
});

it("disables timeline controls when all candidates are unscheduled", async () => {
    const projection = fixture();
    projection.rows = [];
    projection.counts = { candidates: 1, scheduled: 0, unscheduled: 1, invalid: 0 };
    projection.nodes = projection.nodes.map((node) => ({ ...node, status: "unscheduled" }));
    await render(projection);
    expect(host.querySelector('[role="grid"]')).toBeNull();
    expect(element("input").disabled).toBe(true);
    expect(host.textContent).toContain("No scheduled entries");
    const details = element("details");
    await flush(() => {
        details.open = true;
        details.dispatchEvent(new Event("toggle"));
    });
    expect(host.textContent).toContain("An exhibition");
    expect(host.textContent).toContain("Unscheduled");
});

it("rejects an oversized zoom while retaining the selected width and viewport", async () => {
    const projection = fixture();
    projection.rows = projection.rows.map((row) => ({ ...row, firstDate: "1890-01-01" }));
    await render(projection);
    const select = element("select");
    expect(select.value).toBe("10");
    const grid = element('[role="grid"]');
    const before = { origin: origin(), left: grid.scrollLeft };
    await flush(() => {
        select.value = "48";
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(select.value).toBe("10");
    expect({ origin: origin(), left: grid.scrollLeft }).toEqual(before);
    expect(element('[role="status"]').textContent).toContain("previous width is retained");
});

it("preserves every node in the complete list when the full timeline cannot fit", async () => {
    const projection = fixture();
    projection.rows = projection.rows.map((row) => ({ ...row, firstDate: "0001-01-01", afterLastDate: "9999-12-31" }));
    await render(projection);
    expect(host.querySelector('[role="grid"]')).toBeNull();
    expect(host.textContent).toContain("Timeline unavailable");
    const details = element("details");
    await flush(() => {
        details.open = true;
        details.dispatchEvent(new Event("toggle"));
    });
    expect(host.textContent).toContain("An exhibition");
});
