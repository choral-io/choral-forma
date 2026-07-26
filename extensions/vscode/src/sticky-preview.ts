type StickyAdapter = (remeasure: boolean) => number | undefined;

type StickyController = { destroy(): void; measure(): void };

export function shouldShowStickyRail(sourceTop: number, boundaryBottom: number, railHeight: number): boolean {
    return sourceTop <= 0 && boundaryBottom > railHeight;
}

export function horizontalScrollTransform(scrollLeft: number): string {
    return `translateX(${String(-scrollLeft)}px)`;
}

const tableHeaderPresentationProperties = [
    "background-color",
    "background-image",
    "border-top-color",
    "border-top-style",
    "border-top-width",
    "border-right-color",
    "border-right-style",
    "border-right-width",
    "border-bottom-color",
    "border-bottom-style",
    "border-bottom-width",
    "border-left-color",
    "border-left-style",
    "border-left-width",
    "color",
    "font-family",
    "font-size",
    "font-stretch",
    "font-style",
    "font-variant",
    "font-weight",
    "letter-spacing",
    "line-height",
    "overflow-wrap",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "text-align",
    "text-decoration-color",
    "text-decoration-line",
    "text-decoration-style",
    "text-transform",
    "vertical-align",
    "white-space",
    "word-break",
] as const;

const kanbanHeaderPresentationProperties = [
    "background-color",
    "background-image",
    "border-top-color",
    "border-top-style",
    "border-top-width",
    "border-right-color",
    "border-right-style",
    "border-right-width",
    "border-bottom-color",
    "border-bottom-style",
    "border-bottom-width",
    "border-left-color",
    "border-left-style",
    "border-left-width",
    "color",
    "font-family",
    "font-size",
    "font-stretch",
    "font-style",
    "font-variant",
    "font-weight",
    "letter-spacing",
    "line-height",
    "margin-block-end",
    "margin-block-start",
    "margin-bottom",
    "margin-left",
    "margin-right",
    "margin-top",
    "overflow-wrap",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "padding-top",
    "text-align",
    "text-decoration-color",
    "text-decoration-line",
    "text-decoration-style",
    "text-transform",
    "vertical-align",
    "white-space",
    "word-break",
] as const;

const kanbanCellSurfacePresentationProperties = ["background-color", "background-image", "color"] as const;

function copyComputedProperties(source: HTMLElement, target: HTMLElement, properties: readonly string[]): void {
    const styles = getComputedStyle(source);
    for (const property of properties) {
        target.style.setProperty(property, styles.getPropertyValue(property));
    }
}

function computedPixels(styles: CSSStyleDeclaration, property: string): number {
    const value = Number.parseFloat(styles.getPropertyValue(property));
    return Number.isFinite(value) ? value : 0;
}

function syncKanbanHeadingRegionCell(sourceCell: HTMLElement, visualCell: HTMLElement): void {
    const styles = getComputedStyle(sourceCell);
    copyComputedProperties(sourceCell, visualCell, kanbanCellSurfacePresentationProperties);
    visualCell.style.border = "0px";
    visualCell.style.borderRadius = "0px";
    visualCell.style.boxShadow = "none";
    visualCell.style.paddingTop = `${String(
        computedPixels(styles, "border-top-width") + computedPixels(styles, "padding-top"),
    )}px`;
    visualCell.style.paddingRight = `${String(
        computedPixels(styles, "border-right-width") + computedPixels(styles, "padding-right"),
    )}px`;
    visualCell.style.paddingBottom = "0px";
    visualCell.style.paddingLeft = `${String(
        computedPixels(styles, "border-left-width") + computedPixels(styles, "padding-left"),
    )}px`;
}

export function syncTableHeaderPresentationStyles(
    sourceTable: HTMLElement,
    sourceHead: HTMLElement,
    visualTable: HTMLElement,
    visualHead: HTMLElement,
    visualTrack: HTMLElement,
): void {
    visualTable.style.borderCollapse = getComputedStyle(sourceTable).borderCollapse;
    copyComputedProperties(sourceHead, visualHead, tableHeaderPresentationProperties);
    const sourceCells = [...sourceHead.querySelectorAll<HTMLElement>("th")];
    const visualCells = [...visualHead.querySelectorAll<HTMLElement>("th")];
    sourceCells.forEach((sourceCell, index) => {
        const visualCell = visualCells[index];
        if (visualCell) copyComputedProperties(sourceCell, visualCell, tableHeaderPresentationProperties);
    });
    const separatorSources = [sourceHead, sourceHead.querySelector<HTMLElement>("tr"), ...sourceCells].filter(
        (element): element is HTMLElement => Boolean(element),
    );
    const separator = separatorSources
        .map((element) => getComputedStyle(element))
        .find((styles) => styles.borderBottomStyle !== "none" && Number.parseFloat(styles.borderBottomWidth) > 0);
    for (const property of ["border-bottom-color", "border-bottom-style", "border-bottom-width"] as const) {
        if (separator) visualTrack.style.setProperty(property, separator.getPropertyValue(property));
        else visualTrack.style.removeProperty(property);
    }
}

export function observePreviewThemeChanges(onChange: () => void): MutationObserver {
    const observer = new MutationObserver(onChange);
    const options: MutationObserverInit = {
        attributes: true,
        attributeFilter: ["class", "style"],
    };
    observer.observe(document.documentElement, options);
    observer.observe(document.body, options);
    return observer;
}

export function createPreviewStickyBoundaryController(
    boundary: HTMLElement,
    source: HTMLElement,
    rail: HTMLElement,
    owner: HTMLElement,
    sync: StickyAdapter,
    resizeObserver?: ResizeObserver,
): StickyController {
    let frame = 0;
    let sourceHeight = 0;
    let remeasurePending = false;
    let destroyed = false;
    const schedule = (remeasure = false): void => {
        remeasurePending ||= remeasure;
        if (frame || destroyed) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (destroyed) return;
            const shouldRemeasure = remeasurePending;
            remeasurePending = false;
            const syncedHeight = sync(shouldRemeasure);
            const sourceRect = source.getBoundingClientRect();
            const boundaryRect = boundary.getBoundingClientRect();
            const measuredRailHeight = rail.getBoundingClientRect().height;
            const stickyHeight = shouldRemeasure ? (syncedHeight ?? sourceHeight) : measuredRailHeight || sourceHeight;
            const visible = shouldShowStickyRail(sourceRect.top, boundaryRect.bottom, stickyHeight);
            rail.classList.toggle("is-visible", visible);
            rail.style.setProperty("--forma-sticky-height", `${String(stickyHeight)}px`);
        });
    };
    const measure = (): void => {
        sourceHeight = source.getBoundingClientRect().height;
        schedule(true);
    };
    const onScroll = (): void => {
        schedule();
    };
    owner.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", measure);
    resizeObserver?.observe(source);
    resizeObserver?.observe(boundary);
    measure();
    return {
        measure,
        destroy() {
            destroyed = true;
            cancelAnimationFrame(frame);
            owner.removeEventListener("scroll", onScroll);
            window.removeEventListener("scroll", onScroll);
            document.removeEventListener("scroll", onScroll, { capture: true });
            window.removeEventListener("resize", measure);
            resizeObserver?.unobserve(source);
            resizeObserver?.unobserve(boundary);
            rail.classList.remove("is-visible");
            rail.style.removeProperty("--forma-sticky-height");
        },
    };
}

function createTableStickyAdapter(
    boundary: HTMLElement,
    rail: HTMLElement,
    owner: HTMLElement,
): StickyAdapter | undefined {
    const sourceTable = boundary.querySelector<HTMLElement>("[data-forma-sticky-source]");
    const sourceHead = sourceTable?.querySelector<HTMLElement>("thead");
    const visualTrack = rail.querySelector<HTMLElement>(".forma-sticky-rail-track");
    const visualTable = rail.querySelector<HTMLElement>("table");
    const visualHead = visualTable?.querySelector<HTMLElement>("thead");
    const visualCells = [...rail.querySelectorAll<HTMLElement>("th")];
    if (!sourceTable || !sourceHead || !visualTrack || !visualTable || !visualHead) return undefined;
    const sourceCells = [...sourceHead.querySelectorAll<HTMLElement>("th")];
    return (remeasure) => {
        visualTable.style.transform = horizontalScrollTransform(owner.scrollLeft);
        if (!remeasure) return;
        syncTableHeaderPresentationStyles(sourceTable, sourceHead, visualTable, visualHead, visualTrack);
        visualTable.style.width = `${String(sourceTable.getBoundingClientRect().width)}px`;
        sourceCells.forEach((cell, index) => {
            const visualCell = visualCells[index];
            if (visualCell) visualCell.style.width = `${String(cell.getBoundingClientRect().width)}px`;
        });
    };
}

function createKanbanStickyAdapter(
    boundary: HTMLElement,
    rail: HTMLElement,
    owner: HTMLElement,
): StickyAdapter | undefined {
    const cells = [...boundary.querySelectorAll<HTMLElement>(".kanban-column")];
    const sourceHeadings = cells
        .map((cell) => cell.querySelector<HTMLElement>("h2"))
        .filter((heading): heading is HTMLElement => Boolean(heading));
    const visualTrack = rail.querySelector<HTMLElement>(".forma-kanban-sticky-track");
    const visualCells = [...rail.querySelectorAll<HTMLElement>(".forma-kanban-sticky-cell")];
    const visualHeadings = visualCells
        .map((cell) => cell.querySelector<HTMLElement>("h2"))
        .filter((heading): heading is HTMLElement => Boolean(heading));
    if (!visualTrack || sourceHeadings.length !== cells.length || visualHeadings.length !== cells.length) {
        return undefined;
    }
    return (remeasure) => {
        visualTrack.style.transform = horizontalScrollTransform(owner.scrollLeft);
        if (!remeasure) return undefined;
        cells.forEach((cell, index) => {
            const visualCell = visualCells[index];
            const visualHeading = visualHeadings[index];
            const sourceHeading = sourceHeadings[index];
            if (!visualCell || !visualHeading || !sourceHeading) return;
            visualCell.style.height = "auto";
            syncKanbanHeadingRegionCell(cell, visualCell);
            visualCell.style.width = `${String(cell.getBoundingClientRect().width)}px`;
            copyComputedProperties(sourceHeading, visualHeading, kanbanHeaderPresentationProperties);
        });
        const first = cells[0];
        const second = cells[1];
        const gap = first && second ? second.getBoundingClientRect().left - first.getBoundingClientRect().right : 0;
        visualTrack.style.gap = `${String(Math.max(0, gap))}px`;
        const heights = visualCells.map((cell, index) => {
            const heading = visualHeadings[index];
            if (!heading) return 0;
            const headingStyles = getComputedStyle(heading);
            const cellRect = cell.getBoundingClientRect();
            const headingRect = heading.getBoundingClientRect();
            const height = Math.max(
                0,
                headingRect.bottom - cellRect.top + computedPixels(headingStyles, "margin-bottom"),
            );
            cell.style.height = `${String(height)}px`;
            return height;
        });
        return Math.max(0, ...heights);
    };
}

class PreviewStickyLifecycle {
    private readonly controllers = new Map<HTMLElement, StickyController>();
    private readonly resizeObserver = new ResizeObserver(() => {
        this.measureControllers();
    });
    private readonly contentObserver = new MutationObserver(() => {
        this.scheduleReconcile();
    });
    private readonly themeObserver = observePreviewThemeChanges(() => {
        this.measureControllers();
    });
    private reconcileFrame = 0;

    constructor() {
        this.reconcile();
        this.contentObserver.observe(document.body, { childList: true, subtree: true });
        window.addEventListener("vscode.markdown.updateContent", this.updatePreviewContent);
        document.addEventListener("vscode.markdown.updateContent", this.updatePreviewContent);
        window.addEventListener("pagehide", stopStickyPreview, { once: true });
    }

    destroy(): void {
        if (this.reconcileFrame) cancelAnimationFrame(this.reconcileFrame);
        this.contentObserver.disconnect();
        this.themeObserver.disconnect();
        for (const controller of this.controllers.values()) controller.destroy();
        this.controllers.clear();
        this.resizeObserver.disconnect();
        window.removeEventListener("vscode.markdown.updateContent", this.updatePreviewContent);
        document.removeEventListener("vscode.markdown.updateContent", this.updatePreviewContent);
        window.removeEventListener("pagehide", stopStickyPreview);
    }

    private readonly updatePreviewContent = (): void => {
        this.measureControllers();
        this.scheduleReconcile();
    };

    private measureControllers(): void {
        for (const controller of this.controllers.values()) controller.measure();
    }

    private scheduleReconcile(): void {
        if (this.reconcileFrame) return;
        this.reconcileFrame = requestAnimationFrame(() => {
            this.reconcileFrame = 0;
            this.reconcile();
        });
    }

    private reconcile(): void {
        const boundaries = new Set(document.querySelectorAll<HTMLElement>("[data-forma-sticky-boundary]"));
        for (const [boundary, controller] of this.controllers) {
            if (boundaries.has(boundary) && document.contains(boundary)) continue;
            controller.destroy();
            this.controllers.delete(boundary);
        }
        for (const boundary of boundaries) {
            if (this.controllers.has(boundary)) continue;
            const controller = this.createController(boundary);
            if (controller) this.controllers.set(boundary, controller);
        }
    }

    private createController(boundary: HTMLElement): StickyController | undefined {
        const rail = boundary.querySelector<HTMLElement>("[data-forma-sticky-rail]");
        const owner = boundary.querySelector<HTMLElement>("[data-forma-sticky-owner]");
        if (!rail || !owner) return undefined;
        const isKanban = boundary.dataset.formaStickyKind === "kanban";
        const source = isKanban
            ? boundary.querySelector<HTMLElement>(".kanban-column")
            : boundary.querySelector<HTMLElement>("[data-forma-sticky-source] thead");
        const adapter = isKanban
            ? createKanbanStickyAdapter(boundary, rail, owner)
            : createTableStickyAdapter(boundary, rail, owner);
        if (!source || !adapter) return undefined;
        return createPreviewStickyBoundaryController(boundary, source, rail, owner, adapter, this.resizeObserver);
    }
}

let lifecycle: PreviewStickyLifecycle | undefined;

export function startStickyPreview(): void {
    lifecycle ??= new PreviewStickyLifecycle();
}

export function stopStickyPreview(): void {
    lifecycle?.destroy();
    lifecycle = undefined;
}
