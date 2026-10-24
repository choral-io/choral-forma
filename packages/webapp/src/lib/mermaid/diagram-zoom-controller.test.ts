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

    it("contains tall media in a bounded viewport without changing default diagram fitting", () => {
        const { canvas, svg } = createFixture();
        setBounds(canvas, 300, 100);
        svg.setAttribute("width", "600");
        svg.setAttribute("height", "400");
        const controller = createSvgDiagramZoomController({ canvas, svg, fitMode: "contain" });
        expect(svg.style.width).toBe("150px");
        expect(controller.getState()).toMatchObject({ scale: 1, x: 75, y: 0 });
        controller.destroy();
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

    it("retains the safe fit basis when resizing a zoomed viewport and Home restores containment", () => {
        const { canvas, svg } = createFixture();
        const controller = createSvgDiagramZoomController({
            canvas,
            svg,
            fitMode: "contain",
            getOverviewSafeInsetRight: () => 44,
        });
        controller.zoomIn();
        notifyResize?.([], {} as ResizeObserver);
        expect(svg.style.width).toBe("256px");
        canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
        expect(controller.getState()).toMatchObject({ scale: 1, x: 0 });
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
        expect(wheelScaleFactor(-10)).toBeCloseTo(Math.exp(0.2));
        expect(wheelScaleFactor(-50)).toBeCloseTo(wheelScaleFactor(-10) ** 5);
        expect(wheelScaleFactor(50)).toBeCloseTo(Math.exp(-1));
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

    it.each(["blur", "pointercancel", "lostpointercapture"])(
        "recovers trackpad zoom after interrupted pointers (%s)",
        (interruption) => {
            const { canvas, svg } = createFixture();
            Object.assign(canvas, {
                hasPointerCapture: () => true,
                releasePointerCapture: vi.fn(),
                setPointerCapture: vi.fn(),
            });
            const controller = createSvgDiagramZoomController({ canvas, svg });
            canvas.dispatchEvent(
                pointer("pointerdown", { clientX: 20, clientY: 20, pointerId: 1, pointerType: "touch" }),
            );
            canvas.dispatchEvent(
                pointer("pointerdown", { clientX: 80, clientY: 20, pointerId: 2, pointerType: "touch" }),
            );
            if (interruption === "blur") window.dispatchEvent(new Event("blur"));
            else
                canvas.dispatchEvent(
                    pointer(interruption, { clientX: 20, clientY: 20, pointerId: 1, pointerType: "touch" }),
                );
            canvas.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: -10, cancelable: true }));
            expect(controller.getState().scale).toBeCloseTo(Math.exp(0.2));
            controller.destroy();
        },
    );

    it("keeps mouse drag continuous when a trackpad wheel gesture changes its transform", () => {
        const { canvas, svg } = createFixture();
        Object.assign(canvas, {
            hasPointerCapture: () => true,
            releasePointerCapture: vi.fn(),
            setPointerCapture: vi.fn(),
        });
        const controller = createSvgDiagramZoomController({ canvas, svg });
        canvas.dispatchEvent(pointer("pointerdown", { clientX: 150, clientY: 100, pointerId: 1 }));
        canvas.dispatchEvent(
            new WheelEvent("wheel", { ctrlKey: true, deltaY: -10, clientX: 150, clientY: 100, cancelable: true }),
        );
        const before = controller.getState();
        expect(before.scale).toBeCloseTo(Math.exp(0.2));
        canvas.dispatchEvent(pointer("pointermove", { clientX: 160, clientY: 100, pointerId: 1 }));
        expect(controller.getState().x - before.x).toBeCloseTo(10);
        controller.destroy();
    });

    it("clears gestures on visibility loss, fit and resize and releases captures on teardown", () => {
        const { canvas, svg } = createFixture();
        const release = vi.fn();
        Object.assign(canvas, {
            hasPointerCapture: () => true,
            releasePointerCapture: release,
            setPointerCapture: vi.fn(),
        });
        const controller = createSvgDiagramZoomController({ canvas, svg });
        const touch = () => {
            canvas.dispatchEvent(
                pointer("pointerdown", { clientX: 20, clientY: 20, pointerId: 1, pointerType: "touch" }),
            );
        };
        const wheel = () => {
            canvas.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: -10, cancelable: true }));
        };
        touch();
        const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
        hidden.mockRestore();
        wheel();
        expect(controller.getState().scale).toBeGreaterThan(1);
        touch();
        controller.reset();
        wheel();
        expect(controller.getState().scale).toBeGreaterThan(1);
        touch();
        notifyResize?.([], {} as ResizeObserver);
        const before = controller.getState().scale;
        wheel();
        expect(controller.getState().scale).toBeGreaterThan(before);
        touch();
        release.mockClear();
        controller.destroy();
        expect(release).toHaveBeenCalledWith(1);
        expect(canvas.style.cursor).toBe("");
    });

    it("keeps the remaining finger active after normal release and its lost-capture event", () => {
        const { canvas, svg } = createFixture();
        const captured = new Set([1, 2]);
        Object.assign(canvas, {
            hasPointerCapture: (id: number) => captured.has(id),
            releasePointerCapture: (id: number) => {
                captured.delete(id);
                canvas.dispatchEvent(
                    pointer("lostpointercapture", { clientX: 0, clientY: 0, pointerId: id, pointerType: "touch" }),
                );
            },
            setPointerCapture: vi.fn(),
        });
        const controller = createSvgDiagramZoomController({ canvas, svg });
        controller.zoomTo(2);
        canvas.dispatchEvent(
            pointer("pointerdown", { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch" }),
        );
        canvas.dispatchEvent(
            pointer("pointerdown", { clientX: 200, clientY: 100, pointerId: 2, pointerType: "touch" }),
        );
        canvas.dispatchEvent(pointer("pointerup", { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch" }));
        const before = controller.getState();
        canvas.dispatchEvent(
            pointer("pointermove", { clientX: 190, clientY: 100, pointerId: 2, pointerType: "touch" }),
        );
        expect(controller.getState().x).toBeCloseTo(before.x - 10);
        canvas.dispatchEvent(pointer("pointerup", { clientX: 190, clientY: 100, pointerId: 2, pointerType: "touch" }));
        canvas.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: -10, cancelable: true }));
        expect(controller.getState().scale).toBeCloseTo(2 * Math.exp(0.2));
        controller.destroy();
    });

    it("ignores late moves after blur and starts a fresh drag without a jump", () => {
        const { canvas, svg } = createFixture();
        Object.assign(canvas, {
            hasPointerCapture: () => true,
            releasePointerCapture: vi.fn(),
            setPointerCapture: vi.fn(),
        });
        const controller = createSvgDiagramZoomController({ canvas, svg });
        controller.zoomTo(2);
        canvas.dispatchEvent(pointer("pointerdown", { clientX: 150, clientY: 100, pointerId: 7 }));
        window.dispatchEvent(new Event("blur"));
        const before = controller.getState();
        canvas.dispatchEvent(pointer("pointermove", { clientX: 250, clientY: 180, pointerId: 7 }));
        expect(controller.getState()).toEqual(before);
        canvas.dispatchEvent(pointer("pointerdown", { clientX: 80, clientY: 40, pointerId: 7 }));
        canvas.dispatchEvent(pointer("pointermove", { clientX: 90, clientY: 40, pointerId: 7 }));
        expect(controller.getState().x).toBeCloseTo(before.x + 10);
        controller.destroy();
    });

    it("removes interruption listeners when the reader is destroyed", () => {
        const { canvas, svg } = createFixture();
        canvas.style.cursor = "crosshair";
        Object.assign(canvas, {
            hasPointerCapture: () => true,
            releasePointerCapture: vi.fn(),
            setPointerCapture: vi.fn(),
        });
        const onChange = vi.fn();
        const controller = createSvgDiagramZoomController({ canvas, svg, onChange });
        canvas.dispatchEvent(pointer("pointerdown", { clientX: 150, clientY: 100, pointerId: 7 }));
        controller.destroy();
        onChange.mockClear();
        window.dispatchEvent(new Event("blur"));
        canvas.dispatchEvent(pointer("pointercancel", { clientX: 150, clientY: 100, pointerId: 7 }));
        canvas.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: -10, cancelable: true }));
        expect(canvas.style.cursor).toBe("crosshair");
        expect(svg.style.transform).toBe("");
        expect(onChange).not.toHaveBeenCalled();
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
