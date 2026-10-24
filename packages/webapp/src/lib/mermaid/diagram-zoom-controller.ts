import { mediaWheelZoomFactor } from "../media-viewer-gestures";

export const mermaidDiagramZoom = {
    keyboardPanPixels: 48,
    maxScale: 3,
    minScale: 1,
    // Keyboard zoom retains deliberate 25% steps; touchpad wheel follows the shared media contract.
    buttonStep: 0.25,
    pinchExponent: 0.8,
} as const;

export interface SvgDiagramZoomState {
    canReset: boolean;
    canZoomIn: boolean;
    canZoomOut: boolean;
    scale: number;
    x: number;
    y: number;
}

export interface SvgDiagramZoomController {
    destroy(): void;
    getState(): SvgDiagramZoomState;
    panBy(x: number, y: number): void;
    reset(): void;
    zoomTo(scale: number): void;
    zoomIn(): void;
    zoomOut(): void;
}

export interface SvgDiagramZoomControllerOptions {
    canvas: HTMLElement;
    /** Inline diagrams keep width fitting; bounded media dialogs contain both axes. */
    fitMode?: "width" | "contain";
    /**
     * Space occupied by overlay controls while the diagram is at its reset
     * overview. Zoomed diagrams retain the entire canvas for inspection.
     */
    getOverviewSafeInsetRight?: () => number;
    onChange?: (state: SvgDiagramZoomState) => void;
    onInteraction?: (state: SvgDiagramZoomState) => void;
    svg: SVGSVGElement;
}

interface DiagramBounds {
    height: number;
    width: number;
}

interface PinchGesture {
    distance: number;
    scale: number;
    x: number;
    y: number;
    midpointX: number;
    midpointY: number;
}

interface PointerSnapshot {
    pointerType: string;
    clientX: number;
    clientY: number;
}

const minimumChange = 0.5;

/**
 * Framework-independent, browser-only viewer for a bounded inline SVG. It
 * deliberately owns only the gesture and viewport contract; callers provide
 * labels, controls, descriptions, and lifecycle integration.
 */
export function createSvgDiagramZoomController({
    canvas,
    fitMode = "width",
    getOverviewSafeInsetRight,
    onChange,
    onInteraction,
    svg,
}: SvgDiagramZoomControllerOptions): SvgDiagramZoomController {
    const baseBounds = naturalSvgBounds(svg);
    const originalStyles = {
        canvasCursor: canvas.style.cursor,
        canvasOverflow: canvas.style.overflow,
        canvasTouchAction: canvas.style.touchAction,
        canvasUserSelect: canvas.style.userSelect,
        svgTransform: svg.style.transform,
        svgTransformOrigin: svg.style.transformOrigin,
        svgUserSelect: svg.style.userSelect,
        svgHeight: svg.style.height,
        svgWidth: svg.style.width,
    };
    const activePointers = new Map<number, PointerSnapshot>();
    let destroyed = false;
    let drag: (PointerSnapshot & { x: number; y: number }) | undefined;
    let gestureChanged = false;
    let hasUserAdjusted = false;
    let interactionTimer: ReturnType<typeof setTimeout> | undefined;
    let pinch: PinchGesture | undefined;
    let fittedBounds = baseBounds;
    let scale: number = mermaidDiagramZoom.minScale;
    let x = 0;
    let y = 0;

    canvas.style.cursor = "grab";
    canvas.style.overflow = "hidden";
    // Preserve one-finger vertical reading scroll. The viewer deliberately
    // owns horizontal panning and two-finger pinch only while the pointer is
    // inside its canvas.
    canvas.style.touchAction = "pan-y";
    canvas.style.userSelect = "none";
    svg.style.transformOrigin = "0 0";
    svg.style.userSelect = "none";

    const resizeObserver =
        typeof ResizeObserver === "undefined"
            ? undefined
            : new ResizeObserver(() => {
                  clearGesture();
                  fitDiagramToCanvas();
                  if (hasUserAdjusted) {
                      constrain();
                  } else {
                      const initial = initialPosition();
                      x = initial.x;
                      y = initial.y;
                  }
                  applyTransform();
                  notify();
              });
    resizeObserver?.observe(canvas);
    canvas.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("pointercancel", clearGesture);
    canvas.addEventListener("lostpointercapture", handleLostPointerCapture);
    window.addEventListener("blur", clearGesture);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    requestAnimationFrame(() => {
        if (!destroyed) {
            reset();
        }
    });

    return { destroy, getState, panBy, reset, zoomIn, zoomOut, zoomTo };

    function destroy() {
        if (destroyed) {
            return;
        }
        destroyed = true;
        clearGesture();
        if (interactionTimer) {
            clearTimeout(interactionTimer);
        }
        resizeObserver?.disconnect();
        canvas.removeEventListener("keydown", handleKeyDown);
        canvas.removeEventListener("pointercancel", clearGesture);
        canvas.removeEventListener("lostpointercapture", handleLostPointerCapture);
        window.removeEventListener("blur", clearGesture);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        canvas.removeEventListener("pointerdown", handlePointerDown);
        canvas.removeEventListener("pointermove", handlePointerMove);
        canvas.removeEventListener("pointerup", handlePointerUp);
        canvas.removeEventListener("wheel", handleWheel);
        canvas.style.cursor = originalStyles.canvasCursor;
        canvas.style.overflow = originalStyles.canvasOverflow;
        canvas.style.touchAction = originalStyles.canvasTouchAction;
        canvas.style.userSelect = originalStyles.canvasUserSelect;
        svg.style.transform = originalStyles.svgTransform;
        svg.style.transformOrigin = originalStyles.svgTransformOrigin;
        svg.style.userSelect = originalStyles.svgUserSelect;
        svg.style.height = originalStyles.svgHeight;
        svg.style.width = originalStyles.svgWidth;
    }

    function getState(): SvgDiagramZoomState {
        const initial = initialPosition();
        return {
            canReset:
                Math.abs(scale - mermaidDiagramZoom.minScale) >= minimumChange / 100 ||
                Math.abs(x - initial.x) >= minimumChange ||
                Math.abs(y - initial.y) >= minimumChange,
            canZoomIn: scale < mermaidDiagramZoom.maxScale - minimumChange / 100,
            canZoomOut: scale > mermaidDiagramZoom.minScale + minimumChange / 100,
            scale,
            x,
            y,
        };
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }
        switch (event.key) {
            case "+":
            case "=":
                event.preventDefault();
                zoomIn();
                notifyInteraction();
                break;
            case "-":
            case "_":
                event.preventDefault();
                zoomOut();
                notifyInteraction();
                break;
            case "0":
            case "Home":
                event.preventDefault();
                reset();
                notifyInteraction();
                break;
            case "ArrowDown":
                event.preventDefault();
                panBy(0, -mermaidDiagramZoom.keyboardPanPixels);
                notifyInteraction();
                break;
            case "ArrowLeft":
                event.preventDefault();
                panBy(mermaidDiagramZoom.keyboardPanPixels, 0);
                notifyInteraction();
                break;
            case "ArrowRight":
                event.preventDefault();
                panBy(-mermaidDiagramZoom.keyboardPanPixels, 0);
                notifyInteraction();
                break;
            case "ArrowUp":
                event.preventDefault();
                panBy(0, mermaidDiagramZoom.keyboardPanPixels);
                notifyInteraction();
                break;
        }
    }

    function clearGesture() {
        const ids = [...activePointers.keys()];
        activePointers.clear();
        drag = undefined;
        pinch = undefined;
        gestureChanged = false;
        canvas.style.cursor = "grab";
        for (const id of ids) {
            if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
        }
    }

    function handleLostPointerCapture(event: PointerEvent) {
        if (activePointers.has(event.pointerId)) clearGesture();
    }

    function handleVisibilityChange() {
        if (document.hidden) clearGesture();
    }

    function handlePointerDown(event: PointerEvent) {
        if (isDiagramControl(event.target)) {
            return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        if (event.pointerType !== "touch") {
            event.preventDefault();
        }
        const point = pointFrom(event, canvas);
        activePointers.set(event.pointerId, point);
        if (event.pointerType !== "touch") {
            canvas.setPointerCapture(event.pointerId);
        }
        if (activePointers.size === 1) {
            drag = { ...point, x, y };
            canvas.style.cursor = "grabbing";
        } else if (activePointers.size === 2) {
            pinch = createPinchGesture(activePointers.values(), scale, x, y);
            drag = undefined;
        }
    }

    function handlePointerMove(event: PointerEvent) {
        if (!activePointers.has(event.pointerId)) {
            return;
        }
        const point = pointFrom(event, canvas);
        activePointers.set(event.pointerId, point);
        if (activePointers.size >= 2 && pinch) {
            const next = createPinchGesture(activePointers.values(), pinch.scale, pinch.x, pinch.y);
            const nextScale = clampScale(pinch.scale * pinchScaleFactor(next.distance, pinch.distance));
            scale = nextScale;
            x = pinch.midpointX - ((pinch.midpointX - pinch.x) / pinch.scale) * nextScale;
            y = pinch.midpointY - ((pinch.midpointY - pinch.y) / pinch.scale) * nextScale;
            hasUserAdjusted = true;
            gestureChanged = true;
            constrain();
            applyTransform();
            notify();
            return;
        }
        if (!drag) {
            return;
        }
        x = drag.x + point.clientX - drag.clientX;
        y = drag.y + point.clientY - drag.clientY;
        hasUserAdjusted = true;
        gestureChanged = true;
        constrain();
        applyTransform();
        notify();
    }

    function handlePointerUp(event: PointerEvent) {
        if (!activePointers.delete(event.pointerId)) {
            return;
        }
        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        if (activePointers.size === 1) {
            const [remaining] = activePointers.values();
            if (remaining) {
                drag = { ...remaining, x, y };
            }
            pinch = undefined;
            return;
        }
        drag = undefined;
        pinch = undefined;
        canvas.style.cursor = "grab";
        if (gestureChanged) {
            gestureChanged = false;
            notifyInteraction();
        }
    }

    function handleWheel(event: WheelEvent) {
        if ([...activePointers.values()].some((point) => point.pointerType === "touch")) return;
        const factor = mediaWheelZoomFactor(event, canvas.clientHeight);
        if (factor === undefined) return;
        event.preventDefault();
        zoomAtPoint(scale * factor, event.clientX, event.clientY);
        // A wheel gesture during mouse drag starts the next drag delta at the new transform.
        if (drag) {
            const point = activePointers.values().next().value;
            if (point) drag = { ...point, x, y };
        }
        if (interactionTimer) {
            clearTimeout(interactionTimer);
        }
        interactionTimer = setTimeout(() => {
            interactionTimer = undefined;
            notifyInteraction();
        }, 150);
    }

    function initialPosition() {
        const canvasBounds = availableCanvasBounds();
        return {
            x: (canvasBounds.width - fittedBounds.width * mermaidDiagramZoom.minScale) / 2,
            y: (canvasBounds.height - fittedBounds.height * mermaidDiagramZoom.minScale) / 2,
        };
    }

    function panBy(deltaX: number, deltaY: number) {
        hasUserAdjusted = true;
        const next = constrainedPosition(x + deltaX, y + deltaY, scale);
        x = next.x;
        y = next.y;
        applyTransform();
        notify();
    }

    function reset() {
        clearGesture();
        hasUserAdjusted = false;
        scale = mermaidDiagramZoom.minScale;
        fitDiagramToCanvas();
        const initial = initialPosition();
        x = initial.x;
        y = initial.y;
        applyTransform();
        notify();
    }

    function zoomAtPoint(nextScale: number, clientX: number, clientY: number) {
        hasUserAdjusted = true;
        const canvasBounds = canvas.getBoundingClientRect();
        const localX = clientX - canvasBounds.left;
        const localY = clientY - canvasBounds.top;
        const boundedScale = clampScale(nextScale);
        x = localX - ((localX - x) / scale) * boundedScale;
        y = localY - ((localY - y) / scale) * boundedScale;
        scale = boundedScale;
        constrain();
        applyTransform();
        notify();
    }

    function zoomIn() {
        zoomTo(scale * (1 + mermaidDiagramZoom.buttonStep));
    }

    function zoomOut() {
        zoomTo(scale / (1 + mermaidDiagramZoom.buttonStep));
    }

    function zoomTo(nextScale: number) {
        const bounds = canvas.getBoundingClientRect();
        zoomAtPoint(nextScale, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }

    function applyTransform() {
        svg.style.transform = `translate3d(${String(x)}px, ${String(y)}px, 0) scale(${String(scale)})`;
    }

    function constrain() {
        const next = constrainedPosition(x, y, scale);
        x = next.x;
        y = next.y;
    }

    function constrainedPosition(nextX: number, nextY: number, nextScale: number) {
        const canvasBounds = availableCanvasBounds(nextScale);
        return {
            x: clampPanAxis(nextX, fittedBounds.width * nextScale, canvasBounds.width),
            y: clampPanAxis(nextY, fittedBounds.height * nextScale, canvasBounds.height),
        };
    }

    function fitDiagramToCanvas() {
        const canvasBounds = availableCanvasBounds(mermaidDiagramZoom.minScale);
        const fitScale = Math.min(
            1,
            canvasBounds.width / baseBounds.width,
            fitMode === "contain" ? canvasBounds.height / baseBounds.height : Infinity,
        );
        fittedBounds = {
            height: baseBounds.height * fitScale,
            width: baseBounds.width * fitScale,
        };
        svg.style.height = "auto";
        svg.style.width = `${String(fittedBounds.width)}px`;
    }

    function availableCanvasBounds(nextScale = scale) {
        const canvasBounds = boundsFor(canvas);
        if (nextScale > mermaidDiagramZoom.minScale + minimumChange / 100) {
            return canvasBounds;
        }
        return {
            ...canvasBounds,
            width: Math.max(0, canvasBounds.width - Math.max(0, getOverviewSafeInsetRight?.() ?? 0)),
        };
    }

    function notify() {
        onChange?.(getState());
    }

    function notifyInteraction() {
        onInteraction?.(getState());
    }
}

function isDiagramControl(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest(".panzoom-exclude"));
}

function boundsFor(element: Element): DiagramBounds {
    const { height, width } = element.getBoundingClientRect();
    return { height, width };
}

function naturalSvgBounds(svg: SVGSVGElement): DiagramBounds {
    const width = Number.parseFloat(svg.getAttribute("width") ?? "");
    const height = Number.parseFloat(svg.getAttribute("height") ?? "");
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return { height, width };
    }
    const viewBox = svg.viewBox.baseVal;
    if (viewBox.width > 0 && viewBox.height > 0) {
        return { height: viewBox.height, width: viewBox.width };
    }
    return boundsFor(svg);
}

function clampPanAxis(value: number, contentSize: number, canvasSize: number) {
    if (contentSize <= canvasSize) {
        return (canvasSize - contentSize) / 2;
    }
    return Math.min(0, Math.max(canvasSize - contentSize, value));
}

function clampScale(value: number) {
    return Math.min(mermaidDiagramZoom.maxScale, Math.max(mermaidDiagramZoom.minScale, value));
}

export { mediaWheelScaleFactor as wheelScaleFactor } from "../media-viewer-gestures";

export function pinchScaleFactor(distance: number, initialDistance: number) {
    if (initialDistance <= 0) {
        return 1;
    }
    return Math.pow(distance / initialDistance, mermaidDiagramZoom.pinchExponent);
}

function createPinchGesture(pointers: Iterable<PointerSnapshot>, scale: number, x: number, y: number): PinchGesture {
    const [first, second] = Array.from(pointers);
    if (!first || !second) {
        throw new Error("Pinch gestures require two active pointers.");
    }
    const midpointX = (first.clientX + second.clientX) / 2;
    const midpointY = (first.clientY + second.clientY) / 2;
    return {
        distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        midpointX,
        midpointY,
        scale,
        x,
        y,
    };
}

function pointFrom(event: PointerEvent, canvas: HTMLElement): PointerSnapshot {
    const bounds = canvas.getBoundingClientRect();
    return {
        clientX: event.clientX - bounds.left,
        clientY: event.clientY - bounds.top,
        pointerType: event.pointerType,
    };
}
