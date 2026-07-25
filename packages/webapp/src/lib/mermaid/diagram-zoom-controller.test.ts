// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    createSvgDiagramZoomController,
    mermaidDiagramZoom,
    pinchScaleFactor,
    wheelScaleFactor,
} from "./diagram-zoom-controller";

describe("SvgDiagramZoomController", () => {
    let notifyResize: ResizeObserverCallback | undefined;

    beforeEach(() => {
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        vi.stubGlobal(
            "ResizeObserver",
            class {
                constructor(callback: ResizeObserverCallback) {
                    notifyResize = callback;
                }

                disconnect = vi.fn();
                observe = vi.fn();
            },
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.replaceChildren();
    });

    it("fits a complete overview, bounds viewer transforms, and resets independently", () => {
        const { canvas, svg } = createFixture();
        const controller = createSvgDiagramZoomController({ canvas, svg });

        expect(controller.getState()).toMatchObject({ canZoomOut: false, scale: 1, x: 0, y: 0 });
        expect(svg.style.transform).toContain("translate3d(0px, 0px, 0) scale(1)");
        expect(svg.style.width).toBe("300px");

        controller.zoomIn();
        expect(controller.getState()).toMatchObject({ canZoomOut: true, scale: 1.25 });
        controller.zoomTo(1.5);
        expect(controller.getState()).toMatchObject({ scale: 1.5 });
        controller.panBy(-10_000, -10_000);
        expect(controller.getState()).toMatchObject({ x: -150, y: -100 });

        controller.reset();
        expect(controller.getState()).toMatchObject({ canReset: false, scale: 1, x: 0, y: 0 });
        controller.destroy();
    });

    it("refits an untouched overview when reader layout settles after mount", () => {
        const { canvas, svg } = createFixture();
        const controller = createSvgDiagramZoomController({ canvas, svg });
        setBounds(canvas, 400, 200);
        notifyResize?.([], {} as ResizeObserver);

        expect(controller.getState()).toMatchObject({ canReset: false, scale: 1, x: 0 });
        expect(svg.style.width).toBe("400px");
        controller.destroy();
    });

    it("keeps the reset overview clear of overlay controls while zoomed inspection reclaims the canvas", () => {
        const { canvas, svg } = createFixture();
        const controller = createSvgDiagramZoomController({
            canvas,
            getOverviewSafeInsetRight: () => 44,
            svg,
        });

        expect(svg.style.width).toBe("256px");
        expect(controller.getState()).toMatchObject({ scale: 1, x: 0 });

        controller.zoomIn();
        controller.panBy(-10_000, 0);
        expect(controller.getState()).toMatchObject({ scale: 1.25, x: -20 });

        controller.reset();
        expect(svg.style.width).toBe("256px");
        expect(controller.getState()).toMatchObject({ canReset: false, scale: 1, x: 0 });
        controller.destroy();
    });

    it("uses Ctrl-wheel for diagram zoom while leaving ordinary wheel scrolling alone", () => {
        const { canvas, svg } = createFixture();
        const controller = createSvgDiagramZoomController({ canvas, svg });
        const ordinary = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -10 });
        canvas.dispatchEvent(ordinary);
        expect(ordinary.defaultPrevented).toBe(false);
        expect(controller.getState().scale).toBe(1);

        const pinch = new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -10 });
        canvas.dispatchEvent(pinch);
        expect(pinch.defaultPrevented).toBe(true);
        expect(controller.getState().scale).toBeGreaterThan(1);
        controller.destroy();
    });

    it("maps continuous wheel and pinch input to conservative bounded zoom factors", () => {
        expect(wheelScaleFactor(-10)).toBeCloseTo(Math.exp(0.05));
        expect(wheelScaleFactor(-10)).toBeLessThan(1 + mermaidDiagramZoom.buttonStep);
        expect(wheelScaleFactor(-10_000)).toBeCloseTo(Math.exp(0.225));
        expect(wheelScaleFactor(10_000)).toBeCloseTo(Math.exp(-0.225));
        expect(pinchScaleFactor(160, 100)).toBeCloseTo(1.6 ** mermaidDiagramZoom.pinchExponent);
        expect(pinchScaleFactor(160, 100)).toBeLessThan(1.6);
        expect(pinchScaleFactor(160, 0)).toBe(1);
    });

    it("keeps keyboard panning and zoom state scoped to the focused diagram", () => {
        const first = createFixture();
        const second = createFixture({ append: true });
        const onInteraction = vi.fn();
        const firstController = createSvgDiagramZoomController({ ...first, onInteraction });
        const secondController = createSvgDiagramZoomController(second);

        first.canvas.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "+" }));
        first.canvas.dispatchEvent(
            new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowRight" }),
        );

        expect(firstController.getState()).toMatchObject({ canReset: true, scale: 1.25, x: -75 });
        expect(secondController.getState()).toMatchObject({ canReset: false, scale: 1, x: 0, y: 0 });
        expect(onInteraction).toHaveBeenCalledTimes(2);
        expect(onInteraction).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 1.25, x: -75 }));
        firstController.destroy();
        secondController.destroy();
    });

    it("supports drag and pinch gestures with pointer capture and restores inline styles on cleanup", () => {
        const { canvas, svg } = createFixture();
        const setPointerCapture = vi.fn();
        const releasePointerCapture = vi.fn();
        Object.assign(canvas, {
            hasPointerCapture: () => true,
            releasePointerCapture,
            setPointerCapture,
        });
        const controller = createSvgDiagramZoomController({ canvas, svg });

        const control = document.createElement("button");
        control.className = "panzoom-exclude";
        canvas.append(control);
        control.dispatchEvent(pointer("pointerdown", { clientX: 120, clientY: 100, pointerId: 9 }));
        expect(setPointerCapture).not.toHaveBeenCalled();

        controller.zoomIn();

        canvas.dispatchEvent(pointer("pointerdown", { clientX: 120, clientY: 100, pointerId: 1 }));
        canvas.dispatchEvent(pointer("pointermove", { clientX: 50, clientY: 40, pointerId: 1 }));
        expect(controller.getState()).toMatchObject({ x: -75, y: -50 });
        canvas.dispatchEvent(pointer("pointerup", { clientX: 50, clientY: 40, pointerId: 1 }));
        expect(setPointerCapture).toHaveBeenCalledWith(1);
        expect(releasePointerCapture).toHaveBeenCalledWith(1);

        canvas.dispatchEvent(
            pointer("pointerdown", { clientX: 100, clientY: 100, pointerId: 2, pointerType: "touch" }),
        );
        canvas.dispatchEvent(
            pointer("pointerdown", { clientX: 200, clientY: 100, pointerId: 3, pointerType: "touch" }),
        );
        canvas.dispatchEvent(
            pointer("pointermove", { clientX: 260, clientY: 100, pointerId: 3, pointerType: "touch" }),
        );
        expect(controller.getState().scale).toBeCloseTo(
            (1 + mermaidDiagramZoom.buttonStep) * 1.6 ** mermaidDiagramZoom.pinchExponent,
        );

        controller.destroy();
        expect(canvas.style.touchAction).toBe("");
        expect(svg.style.transform).toBe("");
    });
});

function createFixture({ append = false }: { append?: boolean } = {}) {
    const fixture = document.createElement("div");
    fixture.innerHTML =
        '<div id="canvas"><svg height="400" viewBox="0 0 600 400" width="600" xmlns="http://www.w3.org/2000/svg"></svg></div>';
    if (!append) {
        document.body.replaceChildren();
    }
    document.body.append(fixture);
    const canvas = fixture.firstElementChild as HTMLElement | null;
    const svg = canvas?.querySelector<SVGSVGElement>("svg");
    if (!canvas || !svg) {
        throw new Error("Fixture is unavailable.");
    }
    setBounds(canvas, 300, 200);
    setBounds(svg, 600, 400);
    return { canvas, svg };
}

function pointer(
    type: string,
    {
        button = 0,
        clientX,
        clientY,
        pointerId,
        pointerType = "mouse",
    }: {
        button?: number;
        clientX: number;
        clientY: number;
        pointerId: number;
        pointerType?: string;
    },
) {
    const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
    Object.defineProperties(event, {
        button: { value: button },
        clientX: { value: clientX },
        clientY: { value: clientY },
        pointerId: { value: pointerId },
        pointerType: { value: pointerType },
    });
    return event;
}

function setBounds(element: Element, width: number, height: number) {
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
        bottom: height,
        height,
        left: 0,
        right: width,
        toJSON: () => ({}),
        top: 0,
        width,
        x: 0,
        y: 0,
    });
}
