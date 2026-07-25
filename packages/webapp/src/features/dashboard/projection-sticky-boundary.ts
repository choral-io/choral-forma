export interface ProjectionStickyBoundaryMetrics {
    boundaryBottom: number;
    sourceBottom: number;
    stickyHeight: number;
    stickyTop: number;
}

export function shouldRevealProjectionStickyHeader({
    boundaryBottom,
    sourceBottom,
    stickyHeight,
    stickyTop,
}: ProjectionStickyBoundaryMetrics): boolean {
    return sourceBottom <= stickyTop && boundaryBottom > stickyTop + stickyHeight;
}

export function createProjectionStickyBoundaryController({
    boundary,
    observe = [],
    source,
    sticky,
    syncPresentation,
}: {
    boundary: HTMLElement;
    observe?: readonly Element[];
    source: HTMLElement;
    sticky: HTMLElement;
    syncPresentation: () => void;
}): () => void {
    let frame: number | undefined;

    function update() {
        frame = undefined;
        syncPresentation();

        const stickyTop = projectionStickyViewportTop(boundary, sticky);
        sticky.toggleAttribute(
            "data-sticky-visible",
            shouldRevealProjectionStickyHeader({
                boundaryBottom: boundary.getBoundingClientRect().bottom,
                sourceBottom: source.getBoundingClientRect().bottom,
                stickyHeight: sticky.getBoundingClientRect().height,
                stickyTop,
            }),
        );
    }

    function scheduleUpdate() {
        if (frame !== undefined) return;
        frame = requestAnimationFrame(update);
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    new Set<Element>([boundary, source, sticky, ...observe]).forEach((element) => {
        resizeObserver.observe(element);
    });
    document.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
        document.removeEventListener("scroll", scheduleUpdate, true);
        window.removeEventListener("resize", scheduleUpdate);
        resizeObserver.disconnect();
        if (frame !== undefined) cancelAnimationFrame(frame);
        sticky.removeAttribute("data-sticky-visible");
    };
}

function projectionStickyViewportTop(boundary: HTMLElement, sticky: HTMLElement): number {
    const scrollOwner = findVerticalScrollOwner(boundary);
    const scrollOwnerTop =
        scrollOwner === document.scrollingElement ? 0 : (scrollOwner?.getBoundingClientRect().top ?? 0);
    const stickyOffset = Number.parseFloat(getComputedStyle(sticky).top);

    return scrollOwnerTop + (Number.isFinite(stickyOffset) ? stickyOffset : 0);
}

function findVerticalScrollOwner(element: HTMLElement): Element | null {
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const overflowY = getComputedStyle(ancestor).overflowY;
        if (/(auto|scroll)/u.test(overflowY) && ancestor.scrollHeight > ancestor.clientHeight) return ancestor;
    }

    return document.scrollingElement;
}
