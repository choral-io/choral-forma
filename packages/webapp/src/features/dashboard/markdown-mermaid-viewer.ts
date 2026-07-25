import {
    createSvgDiagramZoomController,
    mermaidDiagramZoom,
    type SvgDiagramZoomController,
    type SvgDiagramZoomState,
} from "@/lib/mermaid";

const toolButtonClass = "btn btn-ghost btn-sm btn-square panzoom-exclude";
let nextViewerId = 1;

export function enhanceMermaidDiagrams(root: HTMLElement) {
    const viewers = Array.from(root.querySelectorAll<HTMLElement>(".mermaid-diagram")).flatMap((figure) => {
        const viewer = enhanceMermaidDiagram(figure);
        return viewer ? [viewer] : [];
    });

    return () => {
        for (const viewer of viewers) {
            viewer.destroy();
        }
    };
}

function enhanceMermaidDiagram(figure: HTMLElement): MermaidDiagramEnhancement | undefined {
    const canvas = figure.querySelector<HTMLElement>(".mermaid-diagram-viewport");
    const caption = figure.querySelector<HTMLElement>(".mermaid-diagram-caption");
    const description = figure.querySelector<HTMLElement>(".sr-only");
    const svg = canvas?.querySelector<SVGSVGElement>("svg");
    if (!canvas || !caption || !description || !svg) {
        return undefined;
    }
    const viewerCanvas = canvas;
    const viewerDescription = description;
    const viewerSvg = svg;

    const viewerId = `forma-mermaid-viewer-${String(nextViewerId++)}`;
    const captionText = caption.textContent.trim() || "Mermaid diagram";
    const canvasId = viewerCanvas.id || `${viewerId}-canvas`;
    const helpId = `${viewerId}-help`;
    const status = document.createElement("span");
    status.className = "sr-only";
    status.setAttribute("aria-live", "polite");
    status.setAttribute("role", "status");
    figure.append(status);

    const help = document.createElement("p");
    help.className = "sr-only";
    help.id = helpId;
    help.textContent =
        "Use the diagram controls to zoom or reset. When this region is focused, arrow keys pan; plus and minus zoom; zero resets.";
    figure.append(help);
    viewerCanvas.dataset.mermaidViewer = "true";
    viewerCanvas.id = canvasId;
    viewerCanvas.setAttribute(
        "aria-describedby",
        `${viewerCanvas.getAttribute("aria-describedby") ?? ""} ${helpId}`.trim(),
    );
    viewerCanvas.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight + - 0");

    const tools = createTools({ canvasId, caption: captionText, includeSlider: true });
    viewerCanvas.append(tools.element);

    let controller = createController(viewerCanvas, viewerSvg, tools, announce);
    let dialog: HTMLDialogElement | undefined;
    let dialogController: SvgDiagramZoomController | undefined;
    let dialogStatus: HTMLSpanElement | undefined;
    let destroyed = false;

    tools.zoomIn?.addEventListener("click", () => {
        controller.zoomIn();
        announce(controller.getState());
    });
    tools.zoomOut?.addEventListener("click", () => {
        controller.zoomOut();
        announce(controller.getState());
    });
    tools.reset.addEventListener("click", () => {
        controller.reset();
        announce(controller.getState());
    });
    tools.zoomSlider?.addEventListener("input", () => {
        controller.zoomTo(Number(tools.zoomSlider?.value) / 100);
        announce(controller.getState());
    });
    tools.expand?.addEventListener("click", () => {
        openDialog();
    });

    return { destroy };

    function announce(state: SvgDiagramZoomState) {
        syncTools(tools, state);
        status.textContent = `${captionText} zoom ${formatPercent(state.scale)}.`;
    }

    function announceDialogState(state: SvgDiagramZoomState) {
        status.textContent = `${captionText} zoom ${formatPercent(state.scale)}.`;
        if (dialogStatus) {
            dialogStatus.textContent = `Zoom ${formatPercent(state.scale)}`;
        }
    }

    function closeDialog() {
        dialog?.close();
    }

    function destroy() {
        if (destroyed) {
            return;
        }
        destroyed = true;
        closeDialog();
        controller.destroy();
        tools.element.remove();
        help.remove();
        status.remove();
        delete viewerCanvas.dataset.mermaidViewer;
        viewerCanvas.removeAttribute("aria-keyshortcuts");
        viewerCanvas.setAttribute("aria-describedby", viewerDescription.id);
    }

    function openDialog() {
        if (dialog || destroyed) {
            return;
        }
        const originalParent = viewerSvg.parentNode;
        const originalNextSibling = viewerSvg.nextSibling;
        if (!originalParent) {
            return;
        }

        controller.destroy();
        dialog = document.createElement("dialog");
        dialog.className = "modal mermaid-diagram-dialog";
        dialog.setAttribute("aria-labelledby", `${viewerId}-dialog-title`);
        dialog.setAttribute("aria-describedby", `${viewerId}-dialog-description`);

        const surface = document.createElement("div");
        surface.className = "modal-box mermaid-diagram-dialog-surface";
        const header = document.createElement("header");
        header.className = "mermaid-diagram-dialog-header";
        const title = document.createElement("h2");
        title.id = `${viewerId}-dialog-title`;
        title.textContent = captionText;
        const close = createButton("Close diagram", "");
        close.classList.replace("btn-xs", "btn-sm");
        close.classList.add("btn-square");
        close.title = "Close diagram";
        close.append(createCloseIcon());
        header.append(title, close);

        const modalDescription = document.createElement("p");
        modalDescription.className = "sr-only";
        modalDescription.id = `${viewerId}-dialog-description`;
        modalDescription.textContent = viewerDescription.textContent;
        const modalCanvas = document.createElement("div");
        modalCanvas.className = "mermaid-diagram-dialog-canvas";
        modalCanvas.id = `${viewerId}-dialog-canvas`;
        modalCanvas.setAttribute("aria-describedby", `${viewerId}-dialog-help`);
        modalCanvas.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight + - 0");
        modalCanvas.setAttribute("aria-label", `Interactive ${captionText.toLowerCase()}`);
        modalCanvas.setAttribute("role", "region");
        modalCanvas.tabIndex = 0;
        const modalHelp = document.createElement("p");
        modalHelp.className = "sr-only";
        modalHelp.id = `${viewerId}-dialog-help`;
        modalHelp.textContent = help.textContent;

        const modalTools = createTools({
            canvasId: modalCanvas.id,
            caption: captionText,
            includeExpand: false,
            includeSlider: false,
            orientation: "horizontal",
        });
        modalTools.element.classList.add("mermaid-diagram-dialog-tools");
        const footer = document.createElement("footer");
        footer.className = "mermaid-diagram-dialog-footer";
        dialogStatus = document.createElement("span");
        dialogStatus.className = "mermaid-diagram-dialog-status";
        dialogStatus.setAttribute("aria-live", "polite");
        dialogStatus.setAttribute("role", "status");
        footer.append(dialogStatus, modalTools.element);
        surface.append(header, modalDescription, modalCanvas, modalHelp, footer);
        const backdrop = document.createElement("form");
        backdrop.className = "modal-backdrop";
        backdrop.method = "dialog";
        const backdropClose = document.createElement("button");
        backdropClose.type = "submit";
        backdropClose.textContent = "Close diagram";
        backdrop.append(backdropClose);
        dialog.append(surface, backdrop);
        document.body.append(dialog);
        modalCanvas.append(viewerSvg);
        dialogController = createController(modalCanvas, viewerSvg, modalTools, announceDialogState);
        dialogStatus.textContent = `Zoom ${formatPercent(dialogController.getState().scale)}`;

        const announceDialogChange = (action: () => void) => {
            action();
            const state = dialogController?.getState();
            if (state) {
                announceDialogState(state);
            }
        };
        modalTools.zoomIn?.addEventListener("click", () => {
            announceDialogChange(() => {
                dialogController?.zoomIn();
            });
        });
        modalTools.zoomOut?.addEventListener("click", () => {
            announceDialogChange(() => {
                dialogController?.zoomOut();
            });
        });
        modalTools.reset.addEventListener("click", () => {
            announceDialogChange(() => {
                dialogController?.reset();
            });
        });
        close.addEventListener("click", closeDialog);
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                closeDialog();
            }
        });
        dialog.addEventListener(
            "close",
            () => {
                dialogController?.destroy();
                dialogController = undefined;
                dialogStatus = undefined;
                originalParent.insertBefore(viewerSvg, originalNextSibling);
                dialog?.remove();
                dialog = undefined;
                if (!destroyed) {
                    controller = createController(viewerCanvas, viewerSvg, tools, announce);
                    tools.expand?.focus({ preventScroll: true });
                }
            },
            { once: true },
        );
        dialog.showModal();
        close.focus({ preventScroll: true });
    }
}

function createController(
    canvas: HTMLElement,
    svg: SVGSVGElement,
    tools: MermaidDiagramTools,
    onInteraction: (state: SvgDiagramZoomState) => void,
) {
    const controller = createSvgDiagramZoomController({
        canvas,
        onChange(state) {
            syncTools(tools, state);
        },
        onInteraction,
        svg,
    });
    syncTools(tools, controller.getState());
    return controller;
}

function createTools({
    canvasId,
    caption,
    includeExpand = true,
    includeSlider = false,
    orientation = "vertical",
}: {
    canvasId: string;
    caption: string;
    includeExpand?: boolean;
    includeSlider?: boolean;
    orientation?: "horizontal" | "vertical";
}): MermaidDiagramTools {
    const element = document.createElement("div");
    element.className = `mermaid-diagram-control-rail join ${
        orientation === "vertical" ? "join-vertical" : "join-horizontal"
    } panzoom-exclude`;
    element.setAttribute("aria-label", `Controls for ${caption}`);
    element.setAttribute("role", "group");
    const zoomOut = includeSlider ? undefined : createButton(`Zoom out ${caption}`, "−", canvasId);
    const reset = createButton(`Reset ${caption} zoom to 100%`, "", canvasId);
    reset.title = "Reset diagram zoom";
    reset.append(createResetIcon());
    const zoomIn = includeSlider ? undefined : createButton(`Zoom in ${caption}`, "+", canvasId);
    const zoomSlider = includeSlider ? createZoomSlider(caption, canvasId) : undefined;
    let expand: HTMLButtonElement | undefined;
    if (includeExpand) {
        expand = createButton(`Expand ${caption}`, "", canvasId);
        expand.title = "Expand diagram";
        expand.append(createMaximizeIcon());
    }
    element.append(
        ...(zoomSlider ? [zoomSlider] : []),
        ...(zoomIn ? [zoomIn] : []),
        reset,
        ...(zoomOut ? [zoomOut] : []),
        ...(expand ? [expand] : []),
    );
    return { element, expand, reset, zoomIn, zoomOut, zoomSlider };
}

function createButton(label: string, text: string, canvasId?: string) {
    const button = document.createElement("button");
    button.className = `${toolButtonClass} join-item`;
    if (canvasId) {
        button.setAttribute("aria-controls", canvasId);
    }
    button.setAttribute("aria-label", label);
    button.type = "button";
    button.textContent = text;
    return button;
}

function createZoomSlider(caption: string, canvasId: string) {
    const slider = document.createElement("input");
    slider.className = "range range-vertical range-xs h-20 w-5 join-item panzoom-exclude";
    slider.setAttribute("aria-controls", canvasId);
    slider.setAttribute("aria-label", `Zoom ${caption}`);
    slider.setAttribute("aria-orientation", "vertical");
    slider.max = String(Math.round(mermaidDiagramZoom.maxScale * 100));
    slider.min = String(Math.round(mermaidDiagramZoom.minScale * 100));
    slider.step = "5";
    slider.title = "Zoom 100%";
    slider.type = "range";
    slider.value = "100";
    return slider;
}

function createMaximizeIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    for (const pathData of ["M15 3h6v6", "m21 3-7 7", "M9 21H3v-6", "m3 21 7-7"]) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        icon.append(path);
    }
    return icon;
}

function createResetIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    for (const pathData of ["M3 12a9 9 0 1 0 3-6.7", "M3 4v6h6"]) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        icon.append(path);
    }
    return icon;
}

function createCloseIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "16");
    icon.setAttribute("height", "16");
    for (const pathData of ["M18 6 6 18", "m6 6 12 12"]) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        icon.append(path);
    }
    return icon;
}

function formatPercent(scale: number) {
    return `${String(Math.round(scale * 100))}%`;
}

function syncTools(tools: MermaidDiagramTools, state: SvgDiagramZoomState) {
    tools.reset.disabled = !state.canReset;
    if (tools.zoomIn) {
        tools.zoomIn.disabled = !state.canZoomIn;
    }
    if (tools.zoomOut) {
        tools.zoomOut.disabled = !state.canZoomOut;
    }
    if (tools.zoomSlider) {
        const percent = formatPercent(state.scale);
        tools.zoomSlider.value = String(Math.round(state.scale * 100));
        tools.zoomSlider.setAttribute("aria-valuetext", `Zoom ${percent}`);
        tools.zoomSlider.title = `Zoom ${percent}`;
    }
}

interface MermaidDiagramEnhancement {
    destroy(): void;
}

interface MermaidDiagramTools {
    element: HTMLDivElement;
    expand?: HTMLButtonElement;
    reset: HTMLButtonElement;
    zoomIn?: HTMLButtonElement;
    zoomOut?: HTMLButtonElement;
    zoomSlider?: HTMLInputElement;
}
