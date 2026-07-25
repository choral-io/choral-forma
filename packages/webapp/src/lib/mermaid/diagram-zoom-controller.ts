export const mermaidDiagramZoom = {
    keyboardPanPixels: 48,
    maxScale: 3,
    minScale: 1,
    // Buttons and keyboard use deliberate, predictable 25% steps. Continuous
    // inputs use separate damped mappings so a single high-resolution wheel
    // or pinch update cannot jump the view by a button-sized increment.
    buttonStep: 0.25,
    pinchExponent: 0.5,
    wheelDeltaLimit: 120,
    wheelZoomPerPixel: 0.0015,
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
    zoomIn(): void;
    zoomOut(): void;
}

export interface SvgDiagramZoomControllerOptions {
    canvas: HTMLElement;
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
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    requestAnimationFrame(() => {
        if (!destroyed) {
            reset();
        }
    });

    return { destroy, getState, panBy, reset, zoomIn, zoomOut };

    function destroy() {
        if (destroyed) {
            return;
        }
        destroyed = true;
        if (interactionTimer) {
            clearTimeout(interactionTimer);
        }
        resizeObserver?.disconnect();
        canvas.removeEventListener("keydown", handleKeyDown);
        canvas.removeEventListener("pointercancel", handlePointerUp);
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
        // A browser touchpad pinch is exposed as Ctrl-wheel. Do not consume a
        // regular wheel, so page and reader scrolling retain their defaults.
        if (!event.ctrlKey) {
            return;
        }
        event.preventDefault();
        const direction = event.deltaY === 0 && event.deltaX ? event.deltaX : event.deltaY;
        const factor = wheelScaleFactor(normalizeWheelDelta(event, direction, canvas));
        zoomAtPoint(scale * factor, event.clientX, event.clientY);
        if (interactionTimer) {
            clearTimeout(interactionTimer);
        }
        interactionTimer = setTimeout(() => {
            interactionTimer = undefined;
            notifyInteraction();
        }, 150);
    }

    function initialPosition() {
        const canvasBounds = boundsFor(canvas);
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
        hasUserAdjusted = false;
        fitDiagramToCanvas();
        scale = mermaidDiagramZoom.minScale;
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
        const bounds = canvas.getBoundingClientRect();
        zoomAtPoint(
            scale * (1 + mermaidDiagramZoom.buttonStep),
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
        );
    }

    function zoomOut() {
        const bounds = canvas.getBoundingClientRect();
        zoomAtPoint(
            scale / (1 + mermaidDiagramZoom.buttonStep),
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
        );
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
        const canvasBounds = boundsFor(canvas);
        return {
            x: clampPanAxis(nextX, fittedBounds.width * nextScale, canvasBounds.width),
            y: clampPanAxis(nextY, fittedBounds.height * nextScale, canvasBounds.height),
        };
    }

    function fitDiagramToCanvas() {
        const canvasBounds = boundsFor(canvas);
        const fitScale = Math.min(1, canvasBounds.width / baseBounds.width);
        fittedBounds = {
            height: baseBounds.height * fitScale,
            width: baseBounds.width * fitScale,
        };
        svg.style.height = "auto";
        svg.style.width = `${String(fittedBounds.width)}px`;
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

export function wheelScaleFactor(deltaPixels: number) {
    const boundedDelta = Math.min(
        mermaidDiagramZoom.wheelDeltaLimit,
        Math.max(-mermaidDiagramZoom.wheelDeltaLimit, deltaPixels),
    );
    return Math.exp(-boundedDelta * mermaidDiagramZoom.wheelZoomPerPixel);
}

export function pinchScaleFactor(distance: number, initialDistance: number) {
    if (initialDistance <= 0) {
        return 1;
    }
    return Math.pow(distance / initialDistance, mermaidDiagramZoom.pinchExponent);
}

function normalizeWheelDelta(event: WheelEvent, delta: number, canvas: HTMLElement) {
    switch (event.deltaMode) {
        case WheelEvent.DOM_DELTA_LINE:
            return delta * 16;
        case WheelEvent.DOM_DELTA_PAGE:
            return delta * Math.max(canvas.clientHeight, 1);
        default:
            return delta;
    }
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
    return { clientX: event.clientX - bounds.left, clientY: event.clientY - bounds.top };
}
