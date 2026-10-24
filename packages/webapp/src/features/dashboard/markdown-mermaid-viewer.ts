import { createMediaViewerControls, mediaViewerSafeInset } from "@/lib/media-viewer-controls";
import { createSvgDiagramZoomController, type SvgDiagramZoomController, type SvgDiagramZoomState } from "@/lib/mermaid";
import { acquireWorkspaceInteractionLayer } from "@/lib/workspace-interaction-layer";

let nextViewerId = 1;

export function enhanceMermaidDiagrams(root: HTMLElement) {
    const viewers = Array.from(root.querySelectorAll<HTMLElement>(".mermaid-diagram")).flatMap((figure) => {
        const viewer = enhanceMermaidDiagram(figure);
        return viewer ? [viewer] : [];
    });
    return () => {
        for (const viewer of viewers) viewer.destroy();
    };
}

function enhanceMermaidDiagram(figure: HTMLElement) {
    const canvas = figure.querySelector<HTMLElement>(".mermaid-diagram-viewport");
    const caption = figure.querySelector<HTMLElement>(".mermaid-diagram-caption");
    const description = figure.querySelector<HTMLElement>(".sr-only");
    const svg = canvas?.querySelector<SVGSVGElement>("svg");
    if (!canvas || !caption || !description || !svg) return;
    const viewerCanvas = canvas;
    const viewerSvg = svg;
    const captionText = caption.textContent.trim() || "Mermaid diagram";
    const descriptionText = description.textContent;
    const viewerId = `forma-mermaid-viewer-${String(nextViewerId++)}`;
    const originalDescription = canvas.getAttribute("aria-describedby");
    const help = document.createElement("p");
    help.id = `${viewerId}-help`;
    help.className = "sr-only";
    help.textContent =
        "Drag or use arrow keys to pan; plus and minus zoom; zero or Home fits. Escape closes the expanded viewer.";
    const status = document.createElement("span");
    status.className = "sr-only";
    status.setAttribute("aria-live", "polite");
    status.setAttribute("role", "status");
    figure.append(help, status);
    canvas.dataset.mermaidViewer = "true";
    canvas.setAttribute("aria-describedby", `${originalDescription ?? ""} ${help.id}`.trim());
    canvas.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight + - 0 Home");
    const tools = createMediaViewerControls(captionText, false);
    canvas.append(tools.element);
    let controller = createController(canvas, svg, tools, status);
    let closeDialog: (() => void) | undefined;
    let destroyed = false;
    bindTools(tools, () => controller);
    tools.toggle.addEventListener("click", openDialog);

    return {
        destroy() {
            if (destroyed) return;
            destroyed = true;
            closeDialog?.();
            controller.destroy();
            tools.element.remove();
            help.remove();
            status.remove();
            delete viewerCanvas.dataset.mermaidViewer;
            viewerCanvas.removeAttribute("aria-keyshortcuts");
            if (originalDescription === null) viewerCanvas.removeAttribute("aria-describedby");
            else viewerCanvas.setAttribute("aria-describedby", originalDescription);
        },
    };

    function openDialog() {
        if (closeDialog || destroyed || typeof HTMLDialogElement.prototype.showModal !== "function") return;
        const parent = viewerSvg.parentNode;
        const next = viewerSvg.nextSibling;
        if (!parent) return;
        controller.destroy();
        const dialog = document.createElement("dialog");
        dialog.className = "modal media-viewer-dialog mermaid-diagram-expanded-viewer opacity-100 transition-none";
        dialog.ariaLabel = captionText;
        const box = document.createElement("div");
        box.className = "modal-box media-viewer-dialog-box";
        const modalCanvas = document.createElement("div");
        modalCanvas.className = "media-viewer-canvas mermaid-diagram-dialog-canvas h-full";
        modalCanvas.tabIndex = 0;
        modalCanvas.setAttribute("role", "region");
        modalCanvas.ariaLabel = captionText;
        modalCanvas.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight + - 0 Home");
        // Keep descriptions in the top layer too, outside the inert reading surface.
        const modalHelp = help.cloneNode(true) as HTMLElement;
        modalHelp.id = `${viewerId}-dialog-help`;
        modalHelp.textContent = `${descriptionText} ${help.textContent}`;
        modalCanvas.setAttribute("aria-describedby", modalHelp.id);
        const modalStatus = status.cloneNode(false) as HTMLSpanElement;
        const modalTools = createMediaViewerControls(captionText, true);
        modalCanvas.append(viewerSvg, modalTools.element);
        const form = document.createElement("form");
        form.method = "dialog";
        form.hidden = true;
        box.append(modalCanvas, modalHelp, modalStatus, form);
        dialog.append(box);
        document.body.append(dialog);
        dialog.showModal();
        const release = acquireWorkspaceInteractionLayer();
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const modalController = createController(modalCanvas, viewerSvg, modalTools, modalStatus);
        modalCanvas.style.touchAction = "none";
        bindTools(modalTools, () => modalController);
        let closed = false;
        const finish = () => {
            if (closed) return;
            closed = true;
            modalController.destroy();
            release();
            document.body.style.overflow = previousOverflow;
            parent.insertBefore(viewerSvg, next);
            dialog.remove();
            closeDialog = undefined;
            if (!destroyed) {
                controller = createController(viewerCanvas, viewerSvg, tools, status);
                tools.toggle.focus({ preventScroll: true });
            }
        };
        closeDialog = () => {
            dialog.close();
            finish();
        };
        modalTools.toggle.addEventListener("click", closeDialog);
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            closeDialog?.();
        });
        dialog.addEventListener("close", finish, { once: true });
        modalCanvas.focus();
    }
}

type MediaTools = ReturnType<typeof createMediaViewerControls>;
function createController(canvas: HTMLElement, svg: SVGSVGElement, tools: MediaTools, status: HTMLElement) {
    const sync = (state: SvgDiagramZoomState) => {
        const text = `${String(Math.round(state.scale * 100))}% of fit`;
        if (status.textContent !== text) status.textContent = text;
    };
    const controller = createSvgDiagramZoomController({
        canvas,
        svg,
        fitMode: "contain",
        getOverviewSafeInsetRight: () => mediaViewerSafeInset(canvas, tools.element),
        onChange: sync,
    });
    sync(controller.getState());
    return controller;
}
function bindTools(tools: MediaTools, getController: () => SvgDiagramZoomController) {
    tools.reset.addEventListener("click", () => {
        getController().reset();
    });
}
