import { HEADER_HEIGHT } from "./gantt-layout";

/**
 * Keep the connector layer inside the track it describes.
 *
 * The layer is positioned in content space, so it slides under the sticky title
 * column and the sticky header, and it paints over both instead of behind them;
 * raising the sticky cells above it does not help. Clipping the layer at the
 * current offsets is what confines a connector to the area it belongs to.
 *
 * Reconciled on the native scroll frame beside the month labels, not from React
 * state, so a fast scroll cannot show a connector crossing a sticky edge.
 */
export function clipConnectors(scroller: HTMLElement) {
    const layer = scroller.querySelector<SVGElement>("[data-gantt-connectors]");
    if (!layer) return;
    // The layer starts at the track's own origin, so its coordinates and the
    // scroll offsets share a frame: whatever precedes an offset is behind an edge.
    const top = Math.max(0, scroller.scrollTop) + HEADER_HEIGHT;
    const left = Math.max(0, scroller.scrollLeft);
    const clip = `inset(${String(top)}px 0 0 ${String(left)}px)`;
    if (layer.style.clipPath !== clip) layer.style.clipPath = clip;
}
