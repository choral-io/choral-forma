// @vitest-environment jsdom
import type { ViewRenderResult } from "@choral-forma/shared";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import calendar from "../../../packages/shared/src/fixtures/calendar-core.json";
import gantt from "../../../packages/shared/src/fixtures/gantt-core.json";
import { startPreviewBootstrap } from "./preview-bootstrap.ts";
import { renderViewProjectionHtml } from "./preview-renderer.ts";
import { parseTemporalPreviewData, startTemporalPreview } from "./temporal-preview.ts";

vi.mock("@choral-forma/temporal-view/preview.css", () => ({ default: "" }));
let stop: (() => void) | undefined;

async function flush(action: () => void) {
    await act(async () => {
        action();
        await new Promise((resolve) => setTimeout(resolve, 30));
    });
}
function html(kind: "calendar" | "gantt") {
    return renderViewProjectionHtml({
        schemaVersion: 1,
        operation: "view.render",
        status: "passed",
        workspace: { name: "Fixture", root: "." },
        view: { id: "plan", path: "config/plan.md", mode: kind, surface: "page" },
        diagnostics: [],
        render: (kind === "calendar" ? calendar : gantt) as NonNullable<ViewRenderResult["render"]>,
    });
}
function shadow(): ShadowRoot {
    const root = document.querySelector("[data-forma-temporal-host]")?.shadowRoot;
    if (!root) throw new Error("Expected mounted temporal preview");
    return root;
}
function button(label: string): HTMLButtonElement {
    const element = [...shadow().querySelectorAll("button")].find(
        (item) => item.getAttribute("aria-label") === label || item.textContent === label,
    );
    if (!element) throw new Error(`Button missing: ${label}`);
    return element;
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {
                /* Layout is supplied by the fixture. */
            }
            disconnect() {
                /* No native observer was created. */
            }
        },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
        setTimeout(() => {
            callback(0);
        }, 0),
    );
    vi.stubGlobal("cancelAnimationFrame", clearTimeout);
    // DOM coordination only: actual sizes and native dialogs are covered in browsers.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
        return Number.parseFloat(this.style.width) || 800;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
        return Number.parseFloat(this.style.height) || 400;
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: vi.fn() });
});
afterEach(async () => {
    await flush(() => {
        stop?.();
    });
    stop = undefined;
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it("retains Calendar navigation across native content replacement and bridges source links", async () => {
    document.body.innerHTML = html("calendar");
    await flush(() => {
        stop = startTemporalPreview();
    });
    await flush(() => {
        button("Next month").click();
    });
    const month = shadow().querySelector("h2")?.textContent;
    await flush(() => {
        button("Agenda").click();
    });
    await flush(() => {
        document.body.innerHTML = html("calendar");
        window.dispatchEvent(new Event("vscode.markdown.updateContent"));
    });
    expect(shadow().querySelector("h2")?.textContent).toBe(month);
    expect(button("Agenda").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector<HTMLElement>("[data-forma-temporal-fallback]")?.hidden).toBe(true);
    const clicked: string[] = [];
    const external: string[] = [];
    const listener = (event: Event) => {
        if (event.target instanceof HTMLAnchorElement) {
            clicked.push(event.target.dataset.href ?? "");
            event.preventDefault();
            event.stopPropagation();
        }
    };
    // Native WebView observes the composed path at window bubble, even after preventDefault.
    const hostListener = (event: Event) => {
        const anchor = event.composedPath().find((node) => node instanceof HTMLAnchorElement);
        if (anchor instanceof HTMLAnchorElement) external.push(anchor.href);
    };
    document.addEventListener("click", listener, true);
    window.addEventListener("click", hostListener);
    await flush(() => {
        shadow().querySelector<HTMLAnchorElement>("a")?.click();
    });
    document.removeEventListener("click", listener, true);
    window.removeEventListener("click", hostListener);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]).toMatch(/^\.\.\/exhibits\//);
    expect(external).toEqual([]);
    const mounted = shadow();
    await flush(() => {
        stop?.();
        stop = undefined;
    });
    expect(mounted.querySelector("section")).toBeNull();
});

it.each(["button", "Enter"])("jumps Calendar months with %s without native form submission", async (action) => {
    document.body.innerHTML = html("calendar");
    await flush(() => {
        stop = startTemporalPreview();
    });
    const panel = shadow().querySelector<HTMLElement>("[popover]");
    const input = panel?.querySelector<HTMLInputElement>("input");
    if (!panel || !input) throw new Error("Missing month picker");
    const hidePopover = vi.fn();
    panel.hidePopover = hidePopover;
    input.value = input.type === "month" ? "2028-03" : "2028-03-01";
    await flush(() => {
        if (action === "button") button("Jump").click();
        else input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(shadow().querySelector("h2")?.textContent).toBe("March 2028");
    expect(hidePopover).toHaveBeenCalledOnce();
});

it("retains Gantt width, selection and scrolling through replacement", async () => {
    document.body.innerHTML = html("gantt");
    await flush(() => {
        stop = startTemporalPreview();
    });
    const timeline = shadow().querySelector<HTMLElement>("[data-gantt-timeline]");
    expect(timeline).not.toBeNull();
    await flush(() => {
        timeline?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    const select = shadow().querySelector<HTMLSelectElement>("select");
    await flush(() => {
        if (select) {
            select.value = "48";
            select.dispatchEvent(new Event("change", { bubbles: true }));
        }
    });
    await flush(() => {
        if (timeline) {
            timeline.scrollLeft = 1000;
            timeline.scrollTop = 25;
            timeline.dispatchEvent(new Event("scroll"));
        }
    });
    const selectedRow = timeline?.getAttribute("aria-activedescendant")?.split("-row-")[1];
    await flush(() => {
        document.body.innerHTML = html("gantt");
    });
    const restored = shadow().querySelector<HTMLElement>("[data-gantt-timeline]");
    expect(restored?.getAttribute("aria-activedescendant")?.split("-row-")[1]).toBe(selectedRow);
    expect(shadow().querySelector<HTMLSelectElement>("select")?.value).toBe("48");
    expect(restored?.scrollLeft).toBe(1000);
    expect(restored?.scrollTop).toBe(25);
    expect(shadow().querySelectorAll("[data-gantt-progress]").length).toBeGreaterThan(0);
});

it("keeps the complete fallback on incompatible preview data", async () => {
    for (const data of [
        "broken",
        "null",
        '{"schemaVersion":2}',
        '{"schemaVersion":1,"projection":{"kind":"calendar"}}',
    ])
        expect(parseTemporalPreviewData(data)).toBeUndefined();
    document.body.innerHTML = html("calendar");
    const data = document.querySelector("script");
    if (data) data.textContent = "null";
    await flush(() => {
        stop = startTemporalPreview();
    });
    expect(document.querySelector<HTMLElement>("[data-forma-temporal-fallback]")?.hidden).toBe(false);
    expect(document.querySelector("[data-forma-temporal-host]")?.shadowRoot).toBeNull();
});

it("recovers from a failed render and restores a replaced fallback", async () => {
    document.body.innerHTML = html("calendar");
    await flush(() => {
        stop = startTemporalPreview();
    });
    const source = document.querySelector("script");
    if (!source) throw new Error("Missing projection fixture");
    const valid = source.textContent;
    await flush(() => {
        document.querySelector("[data-forma-temporal-fallback]")?.replaceWith(
            Object.assign(document.createElement("div"), {
                innerHTML: "<div data-forma-temporal-fallback>Fallback</div>",
            }),
        );
        // Accepted shape with an invalid title fails inside the renderer.
        source.textContent = valid.replace('"Unscheduled Exhibit"', '{"invalid":true}');
    });
    await flush(() => {
        /* Let the scheduled reconciliation commit. */
    });
    expect(document.querySelector<HTMLElement>("[data-forma-temporal-host]")?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>("[data-forma-temporal-fallback]")?.hidden).toBe(false);
    await flush(() => {
        source.textContent = valid;
    });
    await flush(() => {
        /* Let the scheduled reconciliation commit. */
    });
    expect(document.querySelector<HTMLElement>("[data-forma-temporal-host]")?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("[data-forma-temporal-fallback]")?.hidden).toBe(true);
});

it("keeps Gantt selection attached to its source when rows reorder", async () => {
    document.body.innerHTML = html("gantt");
    await flush(() => {
        stop = startTemporalPreview();
    });
    const timeline = shadow().querySelector<HTMLElement>("[data-gantt-timeline]");
    await flush(() => {
        timeline?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    const selected = () => shadow().querySelector('[aria-selected="true"] button')?.textContent;
    const title = selected();
    const source = document.querySelector("script");
    if (!source) throw new Error("Missing projection fixture");
    const data = JSON.parse(source.textContent) as { projection: { rows: unknown[] } };
    data.projection.rows.reverse();
    await flush(() => {
        source.textContent = JSON.stringify(data);
    });
    expect(selected()).toBe(title);
});

it("preserves Calendar state through bootstrap deactivation and reactivation", async () => {
    document.body.innerHTML = "<p>Ordinary Markdown</p>";
    await flush(() => {
        stop = startPreviewBootstrap([
            {
                selector: "[data-forma-temporal-host]",
                load: async () => startTemporalPreview,
            },
        ]);
    });
    await flush(() => {
        document.body.innerHTML = html("calendar");
    });
    await flush(() => {
        button("Next month").click();
        button("Agenda").click();
    });
    const month = shadow().querySelector("h2")?.textContent;
    const oldRoot = shadow();
    await flush(() => {
        document.body.innerHTML = "<p>Ordinary Markdown again</p>";
    });
    expect(oldRoot.querySelector("section")).toBeNull();
    await flush(() => {
        document.body.innerHTML = html("calendar");
    });
    expect(shadow().querySelector("h2")?.textContent).toBe(month);
    expect(button("Agenda").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector<HTMLElement>("[data-forma-temporal-fallback]")?.hidden).toBe(true);
});
