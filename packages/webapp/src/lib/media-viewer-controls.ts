import {
    createDiagramViewerCollapseIcon,
    createDiagramViewerExpandIcon,
    createDiagramViewerResetIcon,
} from "./diagram-viewer-icons";

export const mediaViewerControlRailClassName = "diagram-viewer-control-rail panzoom-exclude";
export const mediaViewerControlButtonClassName =
    "btn btn-ghost btn-sm btn-circle diagram-viewer-control-button panzoom-exclude";

/** DOM media readers share the same rail; Graph keeps its engine-owned controls. */
export function createMediaViewerControls(label: string, expanded: boolean) {
    const element = document.createElement("div");
    element.className = mediaViewerControlRailClassName;
    element.setAttribute("aria-label", `Controls for ${label}`);
    element.setAttribute("role", "group");
    const reset = mediaViewerButton(`Fit ${label}`);
    reset.append(createDiagramViewerResetIcon());
    const toggle = mediaViewerButton(expanded ? `Close ${label} viewer` : `Expand ${label}`);
    toggle.append(expanded ? createDiagramViewerCollapseIcon() : createDiagramViewerExpandIcon());
    element.append(reset, toggle);
    return { element, reset, toggle };
}

export function mediaViewerButton(label: string, text = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = mediaViewerControlButtonClassName;
    button.ariaLabel = label;
    button.title = label;
    button.textContent = text;
    return button;
}

/** The rail's measured left edge owns the reset overview's usable width. */
export function mediaViewerSafeInset(canvas: HTMLElement, controls: HTMLElement) {
    const bounds = canvas.getBoundingClientRect();
    const rail = controls.getBoundingClientRect();
    return Math.max(0, bounds.right - rail.left);
}
