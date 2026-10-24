/** Choral Flows media gesture contract: modifier/pinch wheel, normalized units, continuous delta. */
export function mediaWheelZoomFactor(event: WheelEvent, viewportHeight: number): number | undefined {
    if (!event.ctrlKey && !event.metaKey) return;
    const mode = event.deltaMode;
    const delta = event.deltaY || event.deltaX;
    if (!Number.isFinite(delta) || delta === 0) return;
    const unit = mode === 1 ? 16 : mode === 2 ? viewportHeight : 1;
    return mediaWheelScaleFactor(delta * unit);
}

export function mediaWheelScaleFactor(deltaPixels: number) {
    return Math.exp(-deltaPixels * 0.02);
}
