// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
    createPreviewStickyBoundaryController,
    horizontalScrollTransform,
    observePreviewThemeChanges,
    shouldShowStickyRail,
    startStickyPreview,
    stopStickyPreview,
    syncTableHeaderPresentationStyles,
} from "./sticky-preview.ts";

describe("native preview sticky rail lifecycle", () => {
    it("reveals at the source header crossing and hides after the live source exits", () => {
        expect(shouldShowStickyRail(-0.5, 900, 48)).toBe(true);
        expect(shouldShowStickyRail(0.5, 900, 48)).toBe(false);
        expect(shouldShowStickyRail(-50, 900, 48)).toBe(true);
        expect(shouldShowStickyRail(-0.5, 47, 48)).toBe(false);
    });

    it("uses one-way local horizontal scroll transforms", () => {
        expect(horizontalScrollTransform(0)).toBe("translateX(0px)");
        expect(horizontalScrollTransform(240)).toBe("translateX(-240px)");
    });

    it("mirrors table header presentation styles without copying layout controls", () => {
        const sourceTable = document.createElement("table");
        const sourceHead = document.createElement("thead");
        const sourceRow = document.createElement("tr");
        const sourceCell = document.createElement("th");
        sourceTable.style.borderCollapse = "separate";
        sourceCell.style.cssText = [
            "border-bottom: 2px dashed rgb(12, 34, 56)",
            "background-color: rgb(21, 22, 23)",
            "color: rgb(230, 231, 232)",
            "font-family: serif",
            "font-size: 18px",
            "font-weight: 600",
            "line-height: 27px",
            "padding: 7px 11px",
            "white-space: normal",
            "overflow-wrap: anywhere",
            "word-break: break-word",
            "text-align: right",
            "vertical-align: middle",
            "position: fixed",
            "width: 999px",
            "overflow: hidden",
            "transform: translateX(90px)",
        ].join(";");
        sourceRow.append(sourceCell);
        sourceHead.append(sourceRow);
        sourceTable.append(sourceHead);

        const visualTable = document.createElement("table");
        const visualTrack = document.createElement("div");
        const visualHead = document.createElement("thead");
        const visualRow = document.createElement("tr");
        const visualCell = document.createElement("th");
        visualTable.style.tableLayout = "fixed";
        visualTable.style.width = "420px";
        visualTable.style.transform = "translateX(-120px)";
        visualTrack.style.borderTop = "1px solid rgb(1, 2, 3)";
        visualTrack.style.borderBottom = "1px solid rgb(4, 5, 6)";
        visualTrack.style.overflow = "clip";
        visualCell.style.position = "static";
        visualCell.style.width = "180px";
        visualCell.style.overflow = "visible";
        visualRow.append(visualCell);
        visualHead.append(visualRow);
        visualTable.append(visualHead);

        syncTableHeaderPresentationStyles(sourceTable, sourceHead, visualTable, visualHead, visualTrack);

        expect(visualTable.style.borderCollapse).toBe("separate");
        expect(visualTable.style.tableLayout).toBe("fixed");
        expect(visualTable.style.width).toBe("420px");
        expect(visualTable.style.transform).toBe("translateX(-120px)");
        expect(visualCell.style.borderBottomStyle).toBe("dashed");
        expect(visualCell.style.borderBottomWidth).toBe("2px");
        expect(visualCell.style.borderBottomColor).toBe("rgb(12, 34, 56)");
        expect(visualTrack.style.borderBottomStyle).toBe("dashed");
        expect(visualTrack.style.borderBottomWidth).toBe("2px");
        expect(visualTrack.style.borderBottomColor).toBe("rgb(12, 34, 56)");
        expect(visualTrack.style.borderTopColor).toBe("rgb(1, 2, 3)");
        expect(visualTrack.style.overflow).toBe("clip");
        expect(visualCell.style.backgroundColor).toBe("rgb(21, 22, 23)");
        expect(visualCell.style.color).toBe("rgb(230, 231, 232)");
        expect(visualCell.style.fontSize).toBe("18px");
        expect(visualCell.style.lineHeight).toBe("27px");
        expect(visualCell.style.paddingTop).toBe("7px");
        expect(visualCell.style.paddingRight).toBe("11px");
        expect(visualCell.style.whiteSpace).toBe("normal");
        expect(visualCell.style.overflowWrap).toBe("anywhere");
        expect(visualCell.style.wordBreak).toBe("break-word");
        expect(visualCell.style.textAlign).toBe("right");
        expect(visualCell.style.verticalAlign).toBe("middle");
        expect(visualCell.style.position).toBe("static");
        expect(visualCell.style.width).toBe("180px");
        expect(visualCell.style.overflow).toBe("visible");
        expect(visualCell.style.transform).toBe("");
    });

    it("requests presentation resynchronization when host theme attributes change", async () => {
        const resync = vi.fn();
        const observer = observePreviewThemeChanges(resync);

        document.body.classList.add("vscode-light");
        await vi.waitFor(() => {
            expect(resync).toHaveBeenCalledTimes(1);
        });

        document.documentElement.style.setProperty("--vscode-editor-background", "rgb(250, 250, 250)");
        await vi.waitFor(() => {
            expect(resync).toHaveBeenCalledTimes(2);
        });

        observer.disconnect();
    });

    it("owns one reusable observer and event-listener lifecycle", () => {
        let resizeObserverInstances = 0;
        let resizeObserverDisconnects = 0;
        class FakeResizeObserver {
            constructor() {
                resizeObserverInstances += 1;
            }

            observe(): void {
                return undefined;
            }

            unobserve(): void {
                return undefined;
            }

            disconnect(): void {
                resizeObserverDisconnects += 1;
            }
        }
        vi.stubGlobal("ResizeObserver", FakeResizeObserver);
        const addWindowListener = vi.spyOn(window, "addEventListener");
        const removeWindowListener = vi.spyOn(window, "removeEventListener");

        startStickyPreview();
        startStickyPreview();

        expect(resizeObserverInstances).toBe(1);
        expect(addWindowListener.mock.calls.filter(([type]) => type === "pagehide")).toHaveLength(1);

        stopStickyPreview();

        expect(resizeObserverDisconnects).toBe(1);
        expect(removeWindowListener).toHaveBeenCalledWith("pagehide", stopStickyPreview);

        startStickyPreview();
        expect(resizeObserverInstances).toBe(2);
        stopStickyPreview();
        vi.unstubAllGlobals();
    });

    it("uses current wrapped header height after preview resize invalidation", () => {
        const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
            callback(0);
            return 0;
        });
        const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
        let resizeObserver: { observed: Set<Element>; trigger(): void } | undefined;
        class FakeResizeObserver {
            readonly observed = new Set<Element>();

            constructor(private readonly callback: ResizeObserverCallback) {
                resizeObserver = {
                    observed: this.observed,
                    trigger: () => {
                        this.trigger();
                    },
                };
            }

            observe(target: Element): void {
                this.observed.add(target);
            }

            unobserve(target: Element): void {
                this.observed.delete(target);
            }

            disconnect(): void {
                this.observed.clear();
            }

            trigger(): void {
                this.callback([], this);
            }
        }
        vi.stubGlobal("ResizeObserver", FakeResizeObserver);
        document.body.innerHTML =
            '<div data-forma-sticky-boundary data-forma-sticky-kind="table">' +
            '<div data-forma-sticky-rail><div class="forma-sticky-rail-track">' +
            "<table><thead><tr><th>Wrapped heading</th></tr></thead></table>" +
            "</div></div>" +
            "<div data-forma-sticky-owner><table data-forma-sticky-source>" +
            "<thead><tr><th>Wrapped heading</th></tr></thead><tbody><tr><td>Value</td></tr></tbody>" +
            "</table></div></div>";
        const boundary = document.querySelector<HTMLElement>("[data-forma-sticky-boundary]");
        const sourceTable = document.querySelector<HTMLElement>("[data-forma-sticky-source]");
        const sourceHead = sourceTable?.querySelector<HTMLElement>("thead");
        const sourceCell = sourceHead?.querySelector<HTMLElement>("th");
        const rail = document.querySelector<HTMLElement>("[data-forma-sticky-rail]");
        if (!boundary || !sourceTable || !sourceHead || !sourceCell || !rail) {
            throw new Error("Sticky resize fixture is incomplete.");
        }
        let sourceHeight = 32;
        let boundaryBottom = 160;
        Object.defineProperty(sourceHead, "getBoundingClientRect", {
            value: () => ({ top: -12, bottom: -12 + sourceHeight, width: 280, height: sourceHeight }),
        });
        Object.defineProperty(sourceTable, "getBoundingClientRect", {
            value: () => ({ top: -12, bottom: 400, width: 420, height: 412 }),
        });
        Object.defineProperty(sourceCell, "getBoundingClientRect", {
            value: () => ({ top: -12, bottom: -12 + sourceHeight, width: 280, height: sourceHeight }),
        });
        Object.defineProperty(boundary, "getBoundingClientRect", {
            value: () => ({ top: -12, bottom: boundaryBottom, width: 420, height: boundaryBottom + 12 }),
        });
        Object.defineProperty(rail, "getBoundingClientRect", {
            value: () => {
                const railHeight = Number.parseFloat(rail.style.getPropertyValue("--forma-sticky-height")) || 0;
                return { top: 0, bottom: railHeight, width: 420, height: railHeight };
            },
        });

        try {
            startStickyPreview();
            expect(resizeObserver?.observed.has(sourceHead)).toBe(true);
            expect(resizeObserver?.observed.has(boundary)).toBe(true);
            expect(rail.classList.contains("is-visible")).toBe(true);
            expect(rail.style.getPropertyValue("--forma-sticky-height")).toBe("32px");

            sourceHeight = 64;
            resizeObserver?.trigger();
            expect(rail.style.getPropertyValue("--forma-sticky-height")).toBe("64px");

            boundaryBottom = 63;
            resizeObserver?.trigger();
            expect(rail.classList.contains("is-visible")).toBe(false);

            boundaryBottom = 65;
            resizeObserver?.trigger();
            expect(rail.classList.contains("is-visible")).toBe(true);

            sourceHeight = 32;
            boundaryBottom = 33;
            resizeObserver?.trigger();
            expect(rail.style.getPropertyValue("--forma-sticky-height")).toBe("32px");
            expect(rail.classList.contains("is-visible")).toBe(true);
        } finally {
            stopStickyPreview();
            document.body.replaceChildren();
            vi.unstubAllGlobals();
            frame.mockRestore();
            cancel.mockRestore();
        }
    });

    it("keeps uneven Kanban header cards aligned through resize and content mutation", async () => {
        const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
            callback(0);
            return 0;
        });
        const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
        let resizeObserver: { trigger(): void } | undefined;
        class FakeResizeObserver {
            constructor(private readonly callback: ResizeObserverCallback) {
                resizeObserver = {
                    trigger: () => {
                        this.callback([], this);
                    },
                };
            }

            observe(): void {
                return undefined;
            }

            unobserve(): void {
                return undefined;
            }

            disconnect(): void {
                return undefined;
            }
        }
        vi.stubGlobal("ResizeObserver", FakeResizeObserver);
        document.body.innerHTML =
            '<div data-forma-sticky-boundary data-forma-sticky-kind="kanban">' +
            '<div data-forma-sticky-rail><div class="forma-sticky-rail-track"><div class="forma-kanban-sticky-track">' +
            '<div class="forma-kanban-sticky-cell"><h2 aria-hidden="true">Short</h2></div>' +
            '<div class="forma-kanban-sticky-cell"><h2 aria-hidden="true">Wrapped</h2></div>' +
            "</div></div></div>" +
            '<div class="kanban" data-forma-sticky-owner>' +
            '<section class="kanban-column"><h2>Short <span class="count">1</span></h2></section>' +
            '<section class="kanban-column"><h2>Wrapped <span class="count">2</span></h2></section>' +
            "</div></div>";
        const boundary = document.querySelector<HTMLElement>("[data-forma-sticky-boundary]");
        const columns = [...document.querySelectorAll<HTMLElement>(".kanban-column")];
        const headings = columns.map((column) => column.querySelector<HTMLElement>("h2"));
        const rail = document.querySelector<HTMLElement>("[data-forma-sticky-rail]");
        const visualTrack = document.querySelector<HTMLElement>(".forma-kanban-sticky-track");
        const visualCells = [...document.querySelectorAll<HTMLElement>(".forma-kanban-sticky-cell")];
        const visualHeadings = visualCells.map((cell) => cell.querySelector<HTMLElement>("h2"));
        if (
            !boundary ||
            headings.some((heading) => !heading) ||
            !rail ||
            !visualTrack ||
            visualHeadings.some((heading) => !heading)
        ) {
            throw new Error("Kanban sticky resize fixture is incomplete.");
        }
        const sourceHeadings = headings as HTMLElement[];
        const sourceRects = [
            { top: -8, bottom: 22, height: 30, left: 0, right: 180, width: 180 },
            { top: -8, bottom: 46, height: 54, left: 192, right: 392, width: 200 },
        ];
        const sourceRectAt = (index: number) => {
            const sourceRect = sourceRects[index];
            if (!sourceRect) throw new Error(`Missing source rectangle at index ${String(index)}.`);
            return sourceRect;
        };
        sourceHeadings.forEach((heading, index) => {
            heading.style.cssText =
                "margin: 0 0 10px; padding: 3px 7px 8px; border-bottom: 2px solid rgb(120, 120, 120); line-height: 24px; overflow-wrap: anywhere;";
            Object.defineProperty(heading, "getBoundingClientRect", {
                configurable: true,
                value: () => sourceRects[index],
            });
        });
        columns.forEach((column, index) => {
            column.style.cssText =
                "border: 1px solid rgb(80, 80, 80); border-radius: 4px; border-top-left-radius: 4px; border-top-right-radius: 4px; background-color: rgb(30, 30, 30); padding: 10px 12px;";
            Object.defineProperty(column, "getBoundingClientRect", {
                configurable: true,
                value: () => sourceRects[index],
            });
        });
        visualCells.forEach((cell, index) => {
            Object.defineProperty(cell, "getBoundingClientRect", {
                configurable: true,
                value: () => {
                    const sourceRect = sourceRectAt(index);
                    const styles = getComputedStyle(cell);
                    const visualHeading = visualHeadings[index];
                    const headingMarginBottom = visualHeading
                        ? Number.parseFloat(getComputedStyle(visualHeading).marginBottom || "0")
                        : 0;
                    const height =
                        sourceRect.height +
                        headingMarginBottom +
                        Number.parseFloat(styles.paddingTop || "0") +
                        Number.parseFloat(styles.paddingBottom || "0") +
                        Number.parseFloat(styles.borderTopWidth || "0") +
                        Number.parseFloat(styles.borderBottomWidth || "0");
                    return {
                        top: 0,
                        bottom: height,
                        height,
                        left: sourceRect.left,
                        right: sourceRect.right,
                        width: sourceRect.width,
                    };
                },
            });
        });
        visualHeadings.forEach((heading, index) => {
            const visualCell = visualCells[index];
            if (!heading || !visualCell) return;
            Object.defineProperty(heading, "getBoundingClientRect", {
                configurable: true,
                value: () => {
                    const cellStyles = getComputedStyle(visualCell);
                    const top =
                        Number.parseFloat(cellStyles.borderTopWidth || "0") +
                        Number.parseFloat(cellStyles.paddingTop || "0");
                    const sourceRect = sourceRectAt(index);
                    return {
                        top,
                        bottom: top + sourceRect.height,
                        height: sourceRect.height,
                        left: sourceRect.left,
                        right: sourceRect.right,
                        width: sourceRect.width,
                    };
                },
            });
        });
        Object.defineProperty(boundary, "getBoundingClientRect", {
            value: () => ({ top: -8, bottom: 200, height: 208 }),
        });
        Object.defineProperty(rail, "getBoundingClientRect", {
            value: () => {
                const height = Number.parseFloat(rail.style.getPropertyValue("--forma-sticky-height")) || 0;
                return { top: 0, bottom: height, height };
            },
        });

        try {
            startStickyPreview();

            expect(visualCells.map((cell) => cell.style.width)).toEqual(["180px", "200px"]);
            expect(visualTrack.style.gap).toBe("12px");
            expect(visualHeadings.map((heading) => heading?.style.marginBottom)).toEqual(["10px", "10px"]);
            expect(visualHeadings.map((heading) => heading?.style.lineHeight)).toEqual(["24px", "24px"]);
            expect(visualHeadings.map((heading) => heading?.style.borderBottomWidth)).toEqual(["2px", "2px"]);
            expect(visualCells.map((cell) => cell.style.borderBottomWidth)).toEqual(["0px", "0px"]);
            expect(visualCells.map((cell) => cell.style.borderTopWidth)).toEqual(["1px", "1px"]);
            expect(visualCells.map((cell) => cell.style.borderLeftWidth)).toEqual(["1px", "1px"]);
            expect(visualCells.map((cell) => cell.style.borderRightWidth)).toEqual(["1px", "1px"]);
            expect(visualCells.map((cell) => cell.style.borderTopLeftRadius)).toEqual(["4px", "4px"]);
            expect(visualCells.map((cell) => cell.style.borderTopRightRadius)).toEqual(["4px", "4px"]);
            expect(visualCells.map((cell) => cell.style.borderBottomLeftRadius)).toEqual(["0px", "0px"]);
            expect(visualCells.map((cell) => cell.style.borderBottomRightRadius)).toEqual(["0px", "0px"]);
            expect(visualCells.map((cell) => cell.style.boxShadow)).toEqual(["none", "none"]);
            expect(visualCells.map((cell) => cell.style.backgroundColor)).toEqual([
                "rgb(30, 30, 30)",
                "rgb(30, 30, 30)",
            ]);
            expect(visualCells.map((cell) => cell.style.paddingTop)).toEqual(["10px", "10px"]);
            expect(visualCells.map((cell) => cell.style.paddingLeft)).toEqual(["12px", "12px"]);
            expect(visualCells.map((cell) => cell.style.paddingRight)).toEqual(["12px", "12px"]);
            expect(visualCells.map((cell) => cell.style.paddingBottom)).toEqual(["0px", "0px"]);
            expect(visualCells.map((cell) => cell.style.height)).toEqual(["51px", "75px"]);
            expect(rail.style.getPropertyValue("--forma-sticky-height")).toBe("75px");
            expect(rail.classList.contains("is-visible")).toBe(true);

            document.querySelector<HTMLElement>("[data-forma-sticky-owner]")?.dispatchEvent(new Event("scroll"));
            expect(rail.style.getPropertyValue("--forma-sticky-height")).toBe("75px");

            sourceRects[0] = { top: -8, bottom: 42, height: 50, left: 0, right: 180, width: 180 };
            resizeObserver?.trigger();
            expect(rail.style.getPropertyValue("--forma-sticky-height")).toBe("75px");
            expect(visualCells.map((cell) => cell.style.height)).toEqual(["71px", "75px"]);
            expect(visualHeadings[0]?.style.paddingLeft).toBe("7px");

            sourceRects[0] = { top: -8, bottom: 82, height: 90, left: 0, right: 180, width: 180 };
            const mutatedSourceHeading = sourceHeadings[0];
            const mutatedVisualHeading = visualHeadings[0];
            if (!mutatedSourceHeading || !mutatedVisualHeading) {
                throw new Error("Kanban sticky mutation fixture is incomplete.");
            }
            mutatedSourceHeading.textContent = "A much taller live heading";
            mutatedVisualHeading.textContent = "A much taller live heading";
            await vi.waitFor(() => {
                expect(visualCells.map((cell) => cell.style.height)).toEqual(["111px", "75px"]);
                expect(rail.style.getPropertyValue("--forma-sticky-height")).toBe("111px");
            });
        } finally {
            stopStickyPreview();
            document.body.replaceChildren();
            vi.unstubAllGlobals();
            frame.mockRestore();
            cancel.mockRestore();
        }
    });

    it("reveals the Kanban rail when the semantic column edge crosses before its inset heading", () => {
        const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
            callback(0);
            return 0;
        });
        const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
        class FakeResizeObserver {
            observe(): void {
                return undefined;
            }

            unobserve(): void {
                return undefined;
            }

            disconnect(): void {
                return undefined;
            }
        }
        vi.stubGlobal("ResizeObserver", FakeResizeObserver);
        document.body.innerHTML =
            '<div data-forma-sticky-boundary data-forma-sticky-kind="kanban">' +
            '<div data-forma-sticky-rail><div class="forma-sticky-rail-track"><div class="forma-kanban-sticky-track">' +
            '<div class="forma-kanban-sticky-cell"><h2 aria-hidden="true">Title</h2></div>' +
            "</div></div></div>" +
            '<div class="kanban" data-forma-sticky-owner>' +
            '<section class="kanban-column"><h2>Title <span class="count">1</span></h2></section>' +
            "</div></div>";
        const boundary = document.querySelector<HTMLElement>("[data-forma-sticky-boundary]");
        const column = document.querySelector<HTMLElement>(".kanban-column");
        const heading = column?.querySelector<HTMLElement>("h2");
        const rail = document.querySelector<HTMLElement>("[data-forma-sticky-rail]");
        const visualCell = document.querySelector<HTMLElement>(".forma-kanban-sticky-cell");
        const visualHeading = visualCell?.querySelector<HTMLElement>("h2");
        if (!boundary || !column || !heading || !rail || !visualCell || !visualHeading) {
            throw new Error("Kanban sticky threshold fixture is incomplete.");
        }
        let columnTop = 0.5;
        column.style.cssText = "border: 1px solid; padding: 10px;";
        heading.style.cssText = "margin: 0 0 10px; line-height: 30px;";
        Object.defineProperty(column, "getBoundingClientRect", {
            value: () => ({
                top: columnTop,
                bottom: columnTop + 200,
                height: 200,
                left: 0,
                right: 180,
                width: 180,
            }),
        });
        Object.defineProperty(heading, "getBoundingClientRect", {
            value: () => ({
                top: columnTop + 11,
                bottom: columnTop + 41,
                height: 30,
                left: 11,
                right: 169,
                width: 158,
            }),
        });
        Object.defineProperty(visualCell, "getBoundingClientRect", {
            value: () => ({ top: 0, bottom: 51, height: 51, left: 0, right: 180, width: 180 }),
        });
        Object.defineProperty(visualHeading, "getBoundingClientRect", {
            value: () => ({ top: 11, bottom: 41, height: 30, left: 11, right: 169, width: 158 }),
        });
        Object.defineProperty(boundary, "getBoundingClientRect", {
            value: () => ({ top: columnTop, bottom: 300, height: 300 - columnTop }),
        });
        Object.defineProperty(rail, "getBoundingClientRect", {
            value: () => {
                const height = Number.parseFloat(rail.style.getPropertyValue("--forma-sticky-height")) || 0;
                return { top: 0, bottom: height, height };
            },
        });

        try {
            startStickyPreview();
            expect(rail.classList.contains("is-visible")).toBe(false);

            columnTop = -0.5;
            document.dispatchEvent(new Event("scroll"));

            expect(heading.getBoundingClientRect().top).toBe(10.5);
            expect(rail.classList.contains("is-visible")).toBe(true);
        } finally {
            stopStickyPreview();
            document.body.replaceChildren();
            vi.unstubAllGlobals();
            frame.mockRestore();
            cancel.mockRestore();
        }
    });

    it("recalculates on descendant document scroll and removes the listener on cleanup", () => {
        const frame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
            callback(0);
            return 0;
        });
        const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
        const boundary = document.createElement("div");
        const source = document.createElement("thead");
        const rail = document.createElement("div");
        const owner = document.createElement("div");
        const descendant = document.createElement("div");
        const observe = vi.fn();
        const unobserve = vi.fn();
        const resizeObserver = { observe, unobserve } as unknown as ResizeObserver;
        let sourceTop = 12;
        let syncCount = 0;
        Object.defineProperty(source, "getBoundingClientRect", {
            value: () => ({ top: sourceTop, bottom: sourceTop + 48, height: 48 }),
        });
        Object.defineProperty(boundary, "getBoundingClientRect", {
            value: () => ({ top: 0, bottom: 900, height: 900 }),
        });
        Object.defineProperty(rail, "getBoundingClientRect", {
            value: () => ({ top: 0, bottom: 48, height: 48 }),
        });
        boundary.append(rail, owner);
        owner.append(descendant);
        document.body.append(boundary);
        const controller = createPreviewStickyBoundaryController(
            boundary,
            source,
            rail,
            owner,
            () => {
                syncCount += 1;
            },
            resizeObserver,
        );

        expect(rail.classList.contains("is-visible")).toBe(false);
        expect(observe).toHaveBeenCalledWith(source);
        expect(observe).toHaveBeenCalledWith(boundary);
        const beforeScroll = syncCount;
        sourceTop = -12;
        descendant.dispatchEvent(new Event("scroll", { bubbles: true }));
        expect(syncCount).toBeGreaterThan(beforeScroll);
        expect(rail.classList.contains("is-visible")).toBe(true);

        controller.destroy();
        const afterDestroy = syncCount;
        sourceTop = 12;
        descendant.dispatchEvent(new Event("scroll", { bubbles: true }));
        expect(syncCount).toBe(afterDestroy);
        expect(unobserve).toHaveBeenCalledWith(source);
        expect(unobserve).toHaveBeenCalledWith(boundary);
        expect(cancel).toHaveBeenCalled();
        frame.mockRestore();
        cancel.mockRestore();
        boundary.remove();
    });
});
