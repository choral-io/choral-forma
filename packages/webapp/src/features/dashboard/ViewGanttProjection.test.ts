// @vitest-environment jsdom

import type { DashboardViewProjection } from "@/data/workspace-client";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ALL_EDGES_MAX_ROWS, HEADER_HEIGHT, ROW_HEIGHT, dayIndex } from "./gantt-layout";
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
function at<T>(list: T[], index: number): T {
    const value = list[index];
    if (value === undefined) throw new Error(`Missing index ${String(index)}`);
    return value;
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
/**
 * jsdom has no layout, so scroll offsets keep whatever they are given. Model
 * both axes clamping to the current track dimensions, including after extension.
 */
function asRealScroller(scroller: HTMLElement) {
    for (const [offsetKey, extentKey, clientKey, dimension] of [
        ["scrollLeft", "scrollWidth", "clientWidth", "width"],
        ["scrollTop", "scrollHeight", "clientHeight", "height"],
    ] as const) {
        let offset = scroller[offsetKey];
        const extent = () => Number.parseFloat((scroller.firstElementChild as HTMLElement).style[dimension]) || 0;
        Object.defineProperty(scroller, extentKey, { configurable: true, get: extent });
        Object.defineProperty(scroller, offsetKey, {
            configurable: true,
            get: () => offset,
            set: (next: number) => {
                offset = Math.max(0, Math.min(next, extent() - scroller[clientKey]));
            },
        });
    }
}
/** Two rows seventeen months apart, so locating the second one has to scroll. */
function farRowFixture(): Projection {
    const projection = fixture();
    at(projection.rows, 0).firstDate = "2026-01-01";
    at(projection.rows, 0).afterLastDate = "2026-01-08";
    at(projection.rows, 0).temporal = { kind: "date", start: "2026-01-01", endExclusive: "2026-01-08" };
    projection.nodes.push({ ...at(fixture().nodes, 0), path: "b.md", title: "Far away" });
    projection.rows.push({
        ...at(fixture().rows, 0),
        path: "b.md",
        firstDate: "2027-06-01",
        afterLastDate: "2027-06-10",
        temporal: { kind: "date", start: "2027-06-01", endExclusive: "2027-06-10" },
    });
    projection.counts = { candidates: 2, scheduled: 2, unscheduled: 0, invalid: 0 };
    return projection;
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

it("labels the bar without repeating the title to assistive technology", async () => {
    await render();
    const bar = element("[role='gridcell'] > div[aria-hidden='true']");
    expect(bar.textContent).toBe("An exhibition");
    // The gridcell already names the row, so the visible label must stay decoration.
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(bar.className).toContain("overflow-hidden");
    expect(element("[role='gridcell']").getAttribute("aria-label")).toContain("An exhibition");
});

it("fills the authored percent without changing where the bar starts or ends", async () => {
    const projection = fixture();
    at(projection.nodes, 0).progress = 40;
    await render(projection);
    const bar = element("[role='gridcell'] > div[aria-hidden='true']");
    const fill = element("[data-gantt-progress]");
    expect(fill.dataset.ganttProgress).toBe("40");
    expect(fill.style.width).toBe("40%");
    // Progress must not move the bar: its own geometry stays day-derived.
    expect(bar.style.left).toContain("var(--gantt-origin)");
    expect(bar.style.width).toContain("var(--gantt-day)");
    expect(bar.style.width).not.toContain("%");
    // The title is drawn twice so each half contrasts with what is behind it.
    const labels = [...host.querySelectorAll("[role='gridcell'] span")];
    expect(labels).toHaveLength(2);
    expect(labels.every((l) => l.textContent === "An exhibition")).toBe(true);
    expect(labels[1]?.getAttribute("style")).toContain("inset(0 60% 0 0)");
});

it("distinguishes an authored zero from absent progress", async () => {
    const zero = fixture();
    at(zero.nodes, 0).progress = 0;
    await render(zero);
    expect(element("[data-gantt-progress]").dataset.ganttProgress).toBe("0");
    await render(fixture());
    expect(host.querySelector("[data-gantt-progress]")).toBeNull();
});

it("draws a directed connector to an endpoint whose row is not mounted", async () => {
    // Past the all-edges threshold, so only the selection's edges draw, and far
    // enough apart that row windowing cannot have both endpoints mounted.
    const count = ALL_EDGES_MAX_ROWS + 40;
    const projection = fixture();
    projection.nodes = [];
    projection.rows = [];
    projection.edges = [];
    for (let i = 0; i < count; i++) {
        const path = `n${String(i)}.md`;
        projection.nodes.push({ ...at(fixture().nodes, 0), path, title: `Step ${String(i)}` });
        projection.rows.push({
            ...at(fixture().rows, 0),
            path,
            firstDate: "2026-01-01",
            afterLastDate: "2026-02-01",
            temporal: { kind: "date" as const, start: "2026-01-01", endExclusive: "2026-02-01" },
        });
    }
    const first = "n0.md";
    const last = `n${String(count - 1)}.md`;
    projection.edges.push({
        id: JSON.stringify([first, last]),
        from: first,
        to: last,
        relation: "finishToStart",
        status: "anchored",
    });
    projection.counts = { candidates: count, scheduled: count, unscheduled: 0, invalid: 0 };
    await render(projection);
    await flush(() => {
        const row = host.querySelector(`[role="row"][aria-rowindex="2"] button`);
        (row as HTMLElement | null)?.click();
    });
    const mounted = [...host.querySelectorAll("[role='row'][aria-rowindex]")].map((r) =>
        r.getAttribute("aria-rowindex"),
    );
    // The far endpoint is genuinely absent from the document.
    expect(mounted).toContain("2");
    expect(mounted).not.toContain(String(count + 1));
    // The connector still exists, because its geometry is arithmetic.
    const path = element("svg path[marker-end]");
    expect(path.getAttribute("marker-end")).toMatch(/^url\(#.*-arrow\)$/);
    expect(element("svg marker path").getAttribute("fill")).toBe("currentColor");
});

it("routes around a successor that starts before its predecessor ends", async () => {
    const projection = fixture();
    projection.counts = { candidates: 2, scheduled: 2, unscheduled: 0, invalid: 0 };
    projection.nodes.push({ ...at(projection.nodes, 0), path: "b.md", title: "Overlapping" });
    // b starts long before a ends, which is ordinary data because no conflict is computed.
    projection.rows.push({
        ...at(projection.rows, 0),
        path: "b.md",
        firstDate: "2026-01-05",
        afterLastDate: "2026-02-01",
        temporal: { kind: "date", start: "2026-01-05", endExclusive: "2026-02-01" },
    });
    projection.edges.push({
        id: JSON.stringify(["a.md", "b.md"]),
        from: "a.md",
        to: "b.md",
        relation: "finishToStart",
        status: "anchored",
    });
    await render(projection);
    await flush(() => {
        element("[role='row'][aria-rowindex='2'] button").click();
    });
    // Around rather than doubling back: H V H V H instead of H V H.
    const commands = element("svg path[marker-end]").getAttribute("d")?.match(/[HV]/g) ?? [];
    expect(commands.join("")).toBe("HVHVH");
});

function fanOut(count: number, rows = 0) {
    const projection = fixture();
    for (let i = 0; i < rows; i++) {
        const path = `filler${String(i)}.md`;
        projection.nodes.push({ ...at(fixture().nodes, 0), path, title: `Filler ${String(i)}` });
        projection.rows.push({ ...at(fixture().rows, 0), path });
    }
    for (let i = 0; i < count; i++) {
        const path = `s${String(i)}.md`;
        projection.nodes.push({ ...at(fixture().nodes, 0), path, title: `Successor ${String(i)}` });
        projection.rows.push({
            ...at(fixture().rows, 0),
            path,
            firstDate: "2027-06-01",
            afterLastDate: "2027-07-01",
            temporal: { kind: "date" as const, start: "2027-06-01", endExclusive: "2027-07-01" },
        });
        projection.edges.push({
            id: JSON.stringify(["a.md", path]),
            from: "a.md",
            to: path,
            relation: "finishToStart",
            status: "anchored",
        });
    }
    const total = projection.rows.length;
    projection.counts = { candidates: total, scheduled: total, unscheduled: 0, invalid: 0 };
    return projection;
}
/** The riser is the first horizontal target in `M x y H riser V ...`. */
function risers() {
    return [...host.querySelectorAll("svg path[marker-end]")].map((path) =>
        Number(/^M [\d.-]+ [\d.-]+ H ([\d.-]+)/.exec(path.getAttribute("d") ?? "")?.[1]),
    );
}
function riserOrigin(projection: Projection) {
    const grid = element('[role="grid"] > div');
    const day = Number.parseFloat(grid.style.getPropertyValue("--gantt-day"));
    return (dayIndex(at(projection.rows, 0).afterLastDate) - Number(origin())) * day;
}

it("spreads the connectors leaving one predecessor across lanes", async () => {
    // Seven successors: six lanes, then a wrap, so both numbers are pinned.
    const projection = fanOut(7);
    await render(projection);
    // Lane counts and the step are literals here: reading them from the
    // constants would move the expectation with the value under test.
    const x1 = riserOrigin(projection);
    expect(risers()).toEqual([0, 1, 2, 3, 4, 5, 0].map((lane) => x1 + 8 + 3 * lane));
});

it("keeps lane risers inside the direct corridor at the narrowest day width", async () => {
    const projection = fanOut(4);
    for (const row of projection.rows.slice(1)) {
        row.firstDate = "2027-01-05";
        row.temporal = { kind: "date", start: row.firstDate, endExclusive: "2027-02-01" };
    }
    await render(projection);
    await flush(() => {
        const select = element("select");
        select.value = "4";
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const path = at([...host.querySelectorAll<SVGPathElement>("svg path[marker-end]")], 3);
    const direct = /^M [\d.-]+ [\d.-]+ H ([\d.-]+) V [\d.-]+ H ([\d.-]+)$/.exec(path.getAttribute("d") ?? "");
    expect(direct).not.toBeNull();
    const riser = Number(direct?.[1]);
    const targetStart = Number(direct?.[2]);
    // Four days at 4px/day is the direct-route threshold: only the base 8px
    // riser fits while preserving an 8px forward approach into the target.
    expect(targetStart - riser).toBeGreaterThanOrEqual(8);
});

it("uses only the available lane offsets in a short direct corridor", async () => {
    const projection = fanOut(4);
    for (const row of projection.rows.slice(1)) {
        row.firstDate = "2027-01-07";
        row.temporal = { kind: "date", start: row.firstDate, endExclusive: "2027-02-01" };
    }
    await render(projection);
    await flush(() => {
        const select = element("select");
        select.value = "4";
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const x1 = riserOrigin(projection);
    // Six days leave room for lanes 0–2, but not lane 3. Keep the full lane
    // order where possible and share the last available riser thereafter.
    expect(risers()).toEqual([0, 1, 2, 2].map((lane) => x1 + 8 + 3 * lane));
});

it("keeps overlapping-successor detours on the base riser", async () => {
    const projection = fanOut(4);
    for (const row of projection.rows.slice(1)) {
        row.firstDate = "2026-12-29";
        row.temporal = { kind: "date", start: row.firstDate, endExclusive: "2027-01-20" };
    }
    await render(projection);
    await flush(() => {
        const select = element("select");
        select.value = "4";
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const x1 = riserOrigin(projection);
    expect(risers()).toEqual([x1 + 8, x1 + 8, x1 + 8, x1 + 8]);
    expect(
        [...host.querySelectorAll<SVGPathElement>("svg path[marker-end]")].map((path) =>
            (path.getAttribute("d")?.match(/[HV]/g) ?? []).join(""),
        ),
    ).toEqual(["HVHVH", "HVHVH", "HVHVH", "HVHVH"]);
});

it("keeps a connector's lane when only the selected row's edges are drawn", async () => {
    // Above the threshold the drawn set is filtered. Selecting the last
    // successor leaves one edge on screen, and only a lane numbered over every
    // anchored edge still knows it is the third one out of that predecessor;
    // a lane numbered over the drawn edges would restart at zero.
    const projection = fanOut(3, ALL_EDGES_MAX_ROWS);
    await render(projection);
    const scroller = element('[role="grid"]');
    await flush(() => {
        scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    const drawn = risers();
    expect(drawn).toHaveLength(1);
    expect(drawn).toEqual([riserOrigin(projection) + 8 + 3 * 2]);
});

it("keeps the direct route when the successor starts after its predecessor ends", async () => {
    const projection = fixture();
    projection.counts = { candidates: 2, scheduled: 2, unscheduled: 0, invalid: 0 };
    projection.nodes.push({ ...at(projection.nodes, 0), path: "b.md", title: "Later" });
    projection.rows.push({
        ...at(projection.rows, 0),
        path: "b.md",
        firstDate: "2027-06-01",
        afterLastDate: "2027-07-01",
        temporal: { kind: "date", start: "2027-06-01", endExclusive: "2027-07-01" },
    });
    projection.edges.push({
        id: JSON.stringify(["a.md", "b.md"]),
        from: "a.md",
        to: "b.md",
        relation: "finishToStart",
        status: "anchored",
    });
    await render(projection);
    await flush(() => {
        element("[role='row'][aria-rowindex='2'] button").click();
    });
    const commands = element("svg path[marker-end]").getAttribute("d")?.match(/[HV]/g) ?? [];
    expect(commands.join("")).toBe("HVH");
});

/** A staircase of `count` linked rows, long enough to scroll in both directions. */
function chain(count: number) {
    const projection = fixture();
    projection.nodes = [];
    projection.rows = [];
    projection.edges = [];
    for (let i = 0; i < count; i++) {
        const path = `n${String(i)}.md`;
        projection.nodes.push({ ...at(fixture().nodes, 0), path, title: `Step ${String(i)}` });
        projection.rows.push({
            ...at(fixture().rows, 0),
            path,
            firstDate: `2026-01-${String((i % 20) + 1).padStart(2, "0")}`,
            afterLastDate: `2026-02-${String((i % 20) + 1).padStart(2, "0")}`,
            temporal: {
                kind: "date" as const,
                start: `2026-01-${String((i % 20) + 1).padStart(2, "0")}`,
                endExclusive: `2026-02-${String((i % 20) + 1).padStart(2, "0")}`,
            },
        });
        if (i > 0)
            projection.edges.push({
                id: JSON.stringify([`n${String(i - 1)}.md`, path]),
                from: `n${String(i - 1)}.md`,
                to: path,
                relation: "finishToStart",
                status: "anchored",
            });
    }
    projection.counts = { candidates: count, scheduled: count, unscheduled: 0, invalid: 0 };
    return projection;
}

it("draws every edge in a small projection and only the selected row's in a large one", async () => {
    // At the threshold every thread is followable, so nothing is hidden behind a selection.
    await render(chain(ALL_EDGES_MAX_ROWS));
    expect(host.querySelectorAll("svg path[marker-end]").length).toBe(ALL_EDGES_MAX_ROWS - 1);
    // One row past it, the same view would fill with lines joining points that
    // cannot share a screen, so only the selection's edges remain.
    await render(chain(ALL_EDGES_MAX_ROWS + 1));
    expect(host.querySelectorAll("svg path[marker-end]").length).toBe(1);
});

it("states progress as text wherever the fill cannot be seen", async () => {
    const projection = fixture();
    at(projection.nodes, 0).progress = 40;
    // An unscheduled entry has no bar at all, so text is the only way progress shows.
    projection.nodes.push({
        ...at(fixture().nodes, 0),
        path: "b.md",
        title: "Pending",
        status: "unscheduled",
        progress: 0,
    });
    projection.counts = { candidates: 2, scheduled: 1, unscheduled: 1, invalid: 0 };
    await render(projection);
    // The fill is decoration inside an aria-hidden bar; the row's name must carry it.
    expect(element("[role='gridcell']").getAttribute("aria-label")).toContain("40% complete");
    await flush(() => {
        element("[role='row'][aria-rowindex='2'] button").click();
    });
    expect(host.textContent).toContain("40% complete");
    await flush(() => {
        element("details > summary").click();
    });
    const list = element("details").textContent;
    expect(list).toContain("40% complete");
    // Zero is authored and must not read as absent.
    expect(list).toContain("0% complete");
});

it("omits progress text entirely when none was authored", async () => {
    await render();
    expect(element("[role='gridcell']").getAttribute("aria-label")).not.toContain("complete");
    await flush(() => {
        element("details > summary").click();
    });
    expect(element("details").textContent).not.toContain("complete");
});

it("reserves room for a milestone marker instead of letting it cover the title", async () => {
    const plain = fixture();
    await render(plain);
    const plainLabel = element("[role='gridcell'] span");
    const plainBarWidth = element("[role='gridcell'] > div[aria-hidden='true']").style.width;
    expect(plainLabel.className).toContain("pl-1");
    expect(plainLabel.className).not.toContain("pl-4");
    const milestone = fixture();
    at(milestone.rows, 0).milestone = true;
    await render(milestone);
    const label = element("[role='gridcell'] span");
    expect(label.className).toContain("pl-4");
    // The indent is text-only: bar width still answers to dates.
    const bar = element("[role='gridcell'] > div[aria-hidden='true']");
    expect(bar.style.width).toBe(plainBarWidth);
    expect(bar.style.width).toContain("var(--gantt-day)");
});

it("locates a bar on double-click wherever it already sits", async () => {
    await render(farRowFixture());
    const scroller = element('[role="grid"]');
    asRealScroller(scroller);
    const far = element("[role='row'][aria-rowindex='3'] button");

    // A single click only selects; the viewport must not move.
    scroller.scrollLeft = 0;
    await flush(() => {
        far.click();
    });
    expect(scroller.scrollLeft).toBe(0);
    expect(element("[role='row'][aria-selected='true']").getAttribute("aria-rowindex")).toBe("3");

    // Double-click puts the bar head at the same lead-in whatever came before.
    await flush(() => {
        far.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    const located = scroller.scrollLeft;
    expect(located).toBeGreaterThan(0);
    // Two day columns, written as a literal: deriving the expectation from the
    // constant would move both sides together and assert nothing about the count.
    const grid = element('[role="grid"] > div');
    const dayWidth = Number.parseFloat(grid.style.getPropertyValue("--gantt-day"));
    const originDay = Number(grid.style.getPropertyValue("--gantt-origin"));
    expect(located).toBe((dayIndex("2027-06-01") - originDay - 2) * dayWidth);

    // Unconditional: nudging the viewport so the bar is still partly visible must
    // not make the gesture a no-op. A guard that skipped visible bars would leave
    // the offset where it was, so this is what distinguishes the two behaviours.
    scroller.scrollLeft = located + 40;
    expect(scroller.scrollLeft).not.toBe(located);
    await flush(() => {
        far.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(scroller.scrollLeft).toBe(located);
});

it("locates a bar lying past the end of the current track in one gesture", async () => {
    await render(farRowFixture());
    const scroller = element('[role="grid"]');
    asRealScroller(scroller);
    await flush(() => {
        const select = element("select");
        select.value = "4";
        select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // At four pixels a day the track ends barely past the last bar, so the offset
    // the lead-in asks for lies beyond it. A direct write only reaches the track's
    // own end, and because the clamped write leaves the offset where it was, the
    // scroll handler's edge extension never fires and repeating cannot recover.
    const reachable = scroller.scrollWidth - scroller.clientWidth;
    const far = element("[role='row'][aria-rowindex='3'] button");
    await flush(() => {
        far.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    const grid = element('[role="grid"] > div');
    const dayWidth = Number.parseFloat(grid.style.getPropertyValue("--gantt-day"));
    const target = (dayIndex("2027-06-01") - Number(origin()) - 2) * dayWidth;
    // Without this the fixture could drift into a range that already fits, and
    // the test would pass while exercising nothing.
    expect(target).toBeGreaterThan(reachable);
    expect(scroller.scrollLeft).toBe(target);
});

it("locates the selected row from the keyboard", async () => {
    await render(farRowFixture());
    const scroller = element('[role="grid"]');
    asRealScroller(scroller);
    await flush(() => {
        scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    // End selects the last row and nothing more; Enter is what moves the viewport.
    expect(element("[role='row'][aria-selected='true']").getAttribute("aria-rowindex")).toBe("3");
    expect(scroller.scrollLeft).toBe(0);
    await flush(() => {
        scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const grid = element('[role="grid"] > div');
    const dayWidth = Number.parseFloat(grid.style.getPropertyValue("--gantt-day"));
    expect(scroller.scrollLeft).toBe((dayIndex("2027-06-01") - Number(origin()) - 2) * dayWidth);
});

it("centres a located row under the sticky header", async () => {
    await render(chain(80));
    const scroller = element('[role="grid"]');
    asRealScroller(scroller);
    for (let i = 0; i < 40; i++) {
        await flush(() => {
            scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        });
    }
    // Traversal only brings a row to the nearest edge; that is what locating changes.
    const traversed = scroller.scrollTop;
    await flush(() => {
        scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(element("[role='row'][aria-selected='true']").getAttribute("aria-rowindex")).toBe("42");
    // Row 40 is far from both boundaries and can genuinely be centred.
    const band = (HEADER_HEIGHT + scroller.clientHeight) / 2;
    const centred = Math.round(40 * ROW_HEIGHT + HEADER_HEIGHT + ROW_HEIGHT / 2 - band);
    expect(centred).toBeGreaterThan(0);
    expect(centred).toBeLessThan(scroller.scrollHeight - scroller.clientHeight);
    expect(scroller.scrollTop).toBe(centred);
    expect(scroller.scrollTop).not.toBe(traversed);
});

it("clamps locating the last row to the bottom instead of adding space to centre it", async () => {
    await render(chain(80));
    const scroller = element('[role="grid"]');
    asRealScroller(scroller);
    await flush(() => {
        scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    expect(element("[role='row'][aria-selected='true']").getAttribute("aria-rowindex")).toBe("81");
    scroller.scrollTop = 0;
    await flush(() => {
        scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const height = HEADER_HEIGHT + 80 * ROW_HEIGHT;
    const bottom = height - scroller.clientHeight;
    const centred = Math.round(79 * ROW_HEIGHT + ROW_HEIGHT / 2 + HEADER_HEIGHT / 2 - scroller.clientHeight / 2);
    expect(centred).toBeGreaterThan(bottom);
    expect(scroller.scrollHeight).toBe(height);
    expect(scroller.scrollTop).toBe(bottom);
});

it("clips the connector layer to the track on mount and on scroll", async () => {
    // The scroll listener defers to a frame; run it inline so the assertion is exact.
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
    });
    await render(chain(6));
    const scroller = element('[role="grid"]');
    const layer = element("[data-gantt-connectors]");
    // Mounting alone has to clear the header band the layer extends under.
    expect(layer.style.clipPath).toBe(`inset(${String(HEADER_HEIGHT)}px 0 0 0px)`);
    // A vertical-only scroll changes nothing the render path watches, so this
    // isolates the scroll frame: only the listener can move the clip here.
    await flush(() => {
        scroller.scrollTop = 48;
        scroller.dispatchEvent(new Event("scroll"));
    });
    expect(layer.style.clipPath).toBe(`inset(${String(48 + HEADER_HEIGHT)}px 0 0 0px)`);
    await flush(() => {
        scroller.scrollLeft = 320;
        scroller.dispatchEvent(new Event("scroll"));
    });
    expect(layer.style.clipPath).toBe(`inset(${String(48 + HEADER_HEIGHT)}px 0 0 320px)`);
});

it("selects the row when its bar is clicked", async () => {
    const projection = fixture();
    projection.nodes.push({ ...at(fixture().nodes, 0), path: "b.md", title: "Second" });
    projection.rows.push({ ...at(fixture().rows, 0), path: "b.md" });
    projection.counts = { candidates: 2, scheduled: 2, unscheduled: 0, invalid: 0 };
    await render(projection);
    const cells = [...host.querySelectorAll("[role='gridcell']")];
    await flush(() => {
        (cells[1] as HTMLElement | undefined)?.click();
    });
    expect(element("[role='row'][aria-selected='true']").getAttribute("aria-rowindex")).toBe("3");
});

it("does not scroll horizontally while traversing rows by keyboard", async () => {
    const projection = fixture();
    projection.nodes.push({ ...at(fixture().nodes, 0), path: "b.md", title: "Far away" });
    projection.rows.push({
        ...at(fixture().rows, 0),
        path: "b.md",
        firstDate: "2027-06-01",
        afterLastDate: "2027-06-10",
        temporal: { kind: "date", start: "2027-06-01", endExclusive: "2027-06-10" },
    });
    projection.counts = { candidates: 2, scheduled: 2, unscheduled: 0, invalid: 0 };
    await render(projection);
    const scroller = element('[role="grid"]');
    scroller.scrollLeft = 120;
    // Arrow traversal would otherwise send the viewport chasing bars across years.
    await flush(() => {
        scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(scroller.scrollLeft).toBe(120);
});
