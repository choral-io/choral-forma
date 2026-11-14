import { useEffect, useState, type RefObject } from "react";

export interface ReadingPosition {
    /** Heading of the section at the top of the reading area. */
    activeHeadingId: string | undefined;
    /** Whether the reader has scrolled beyond one viewport. */
    pastFirstViewport: boolean;
}

/**
 * The last heading that has reached the reading line. `tops` are viewport
 * offsets in outline order; a heading that is not rendered has none.
 */
export function activeHeadingId(ids: readonly string[], tops: readonly (number | undefined)[], readingLine: number) {
    let active: string | undefined;
    ids.forEach((id, index) => {
        const top = tops[index];
        if (top !== undefined && top <= readingLine) active = id;
    });
    return active;
}

const readingLineOffset = 32;

/**
 * Follows the scroll container that owns `rootRef`. Document content renders
 * asynchronously, so the position is measured again whenever the root resizes.
 */
export function useReadingPosition(rootRef: RefObject<HTMLElement | null>, headingIds: readonly string[]) {
    const [position, setPosition] = useState<ReadingPosition>({
        activeHeadingId: undefined,
        pastFirstViewport: false,
    });
    const headingKey = headingIds.join("\n");

    useEffect(() => {
        const root = rootRef.current;
        const scroller = root?.closest<HTMLElement>("main");
        if (!root || !scroller) return;
        const ids = headingKey ? headingKey.split("\n") : [];

        const measure = () => {
            const readingLine = scroller.getBoundingClientRect().top + readingLineOffset;
            const tops = ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top);
            const next: ReadingPosition = {
                activeHeadingId: activeHeadingId(ids, tops, readingLine),
                pastFirstViewport: scroller.scrollTop > scroller.clientHeight,
            };
            setPosition((current) =>
                current.activeHeadingId === next.activeHeadingId && current.pastFirstViewport === next.pastFirstViewport
                    ? current
                    : next,
            );
        };

        scroller.addEventListener("scroll", measure, { passive: true });
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(root);
        measure();
        return () => {
            scroller.removeEventListener("scroll", measure);
            resizeObserver.disconnect();
        };
    }, [headingKey, rootRef]);

    return position;
}
