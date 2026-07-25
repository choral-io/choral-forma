import { createSvgDiagramZoomController, type SvgDiagramZoomController, type SvgDiagramZoomState } from "@/lib/mermaid";

const toolButtonClass = "btn btn-ghost btn-xs panzoom-exclude";
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
    const source = figure.querySelector<HTMLElement>(".mermaid-diagram-source code")?.textContent ?? "";
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

    const tools = createTools({ canvasId, caption: captionText });
    caption.append(tools.element);

    let controller = createController(viewerCanvas, viewerSvg, tools, announce);
    let dialog: HTMLDialogElement | undefined;
    let dialogController: SvgDiagramZoomController | undefined;
    let destroyed = false;

    tools.zoomIn.addEventListener("click", () => {
        controller.zoomIn();
        announce(controller.getState());
    });
    tools.zoomOut.addEventListener("click", () => {
        controller.zoomOut();
        announce(controller.getState());
    });
    tools.reset.addEventListener("click", () => {
        controller.reset();
        announce(controller.getState());
    });
    tools.expand.addEventListener("click", () => {
        openDialog();
    });

    return { destroy };

    function announce(state: SvgDiagramZoomState) {
        syncTools(tools, state);
        status.textContent = `${captionText} zoom ${formatPercent(state.scale)}.`;
    }

    function announceDialogState(state: SvgDiagramZoomState) {
        status.textContent = `${captionText} zoom ${formatPercent(state.scale)}.`;
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
        dialog.className = "mermaid-diagram-dialog";
        dialog.setAttribute("aria-labelledby", `${viewerId}-dialog-title`);
        dialog.setAttribute("aria-describedby", `${viewerId}-dialog-description`);

        const surface = document.createElement("div");
        surface.className = "mermaid-diagram-dialog-surface";
        const header = document.createElement("header");
        header.className = "mermaid-diagram-dialog-header";
        const title = document.createElement("h2");
        title.id = `${viewerId}-dialog-title`;
        title.textContent = captionText;
        const close = createButton("Close diagram", "Close");
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

        const modalTools = createTools({ canvasId: modalCanvas.id, caption: captionText, includeExpand: false });
        modalTools.element.classList.add("mermaid-diagram-dialog-tools");
        modalTools.element.open = true;
        const modalSource = createSourceDisclosure(source, captionText);
        surface.append(header, modalDescription, modalTools.element, modalCanvas, modalHelp, modalSource);
        dialog.append(surface);
        document.body.append(dialog);
        modalCanvas.append(viewerSvg);
        dialogController = createController(modalCanvas, viewerSvg, modalTools, announceDialogState);

        const announceDialogChange = (action: () => void) => {
            action();
            const state = dialogController?.getState();
            if (state) {
                status.textContent = `${captionText} zoom ${formatPercent(state.scale)}.`;
            }
        };
        modalTools.zoomIn.addEventListener("click", () => {
            announceDialogChange(() => {
                dialogController?.zoomIn();
            });
        });
        modalTools.zoomOut.addEventListener("click", () => {
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
                originalParent.insertBefore(viewerSvg, originalNextSibling);
                dialog?.remove();
                dialog = undefined;
                if (!destroyed) {
                    controller = createController(viewerCanvas, viewerSvg, tools, announce);
                    tools.expand.focus({ preventScroll: true });
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
}: {
    canvasId: string;
    caption: string;
    includeExpand?: boolean;
}): MermaidDiagramTools {
    const element = document.createElement("details");
    element.className = "mermaid-diagram-tools panzoom-exclude";
    const summary = document.createElement("summary");
    summary.className = "btn btn-ghost btn-xs";
    summary.setAttribute("aria-label", `Diagram controls for ${caption}`);
    summary.textContent = "Inspect";
    const panel = document.createElement("div");
    panel.className = "mermaid-diagram-tool-panel join join-horizontal";
    panel.setAttribute("aria-label", `Controls for ${caption}`);
    panel.setAttribute("role", "group");
    const zoomOut = createButton(`Zoom out ${caption}`, "−", canvasId);
    const reset = createButton(`Reset ${caption} zoom to 100%`, "100%", canvasId);
    const zoomIn = createButton(`Zoom in ${caption}`, "+", canvasId);
    panel.append(zoomOut, reset, zoomIn);
    let expand: HTMLButtonElement | undefined;
    if (includeExpand) {
        expand = createButton(`Expand ${caption}`, "Expand", canvasId);
        panel.append(expand);
    }
    element.append(summary, panel);
    return { element, expand: expand ?? createButton(`Expand ${caption}`, "Expand", canvasId), reset, zoomIn, zoomOut };
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

function createSourceDisclosure(source: string, caption: string) {
    const details = document.createElement("details");
    details.className = "mermaid-diagram-dialog-source";
    const summary = document.createElement("summary");
    summary.textContent = "View Mermaid source";
    const pre = document.createElement("pre");
    pre.setAttribute("aria-label", `Mermaid source for ${caption}`);
    pre.setAttribute("role", "region");
    pre.tabIndex = 0;
    const code = document.createElement("code");
    code.className = "language-mermaid";
    code.textContent = source;
    pre.append(code);
    details.append(summary, pre);
    return details;
}

function formatPercent(scale: number) {
    return `${String(Math.round(scale * 100))}%`;
}

function syncTools(tools: MermaidDiagramTools, state: SvgDiagramZoomState) {
    tools.reset.disabled = !state.canReset;
    tools.zoomIn.disabled = !state.canZoomIn;
    tools.zoomOut.disabled = !state.canZoomOut;
}

interface MermaidDiagramEnhancement {
    destroy(): void;
}

interface MermaidDiagramTools {
    element: HTMLDetailsElement;
    expand: HTMLButtonElement;
    reset: HTMLButtonElement;
    zoomIn: HTMLButtonElement;
    zoomOut: HTMLButtonElement;
}
