const outcomeDuration = 1800;

/**
 * Copies a source path from an icon button and shows the outcome, as the reader's own copy
 * controls do: a check while it is copied, or an error state with a failed icon when the
 * clipboard refuses. The button's label names the outcome, then everything resets.
 */
export async function copySourcePath(button: HTMLButtonElement, path: string) {
    const icons = {
        copy: button.querySelector<SVGElement>("[data-copy-icon]"),
        copied: button.querySelector<SVGElement>("[data-copied-icon]"),
        failed: button.querySelector<SVGElement>("[data-copy-failed-icon]"),
    };
    const originalLabel = button.getAttribute("aria-label") ?? "Copy source path";

    let copied: boolean;
    try {
        await navigator.clipboard.writeText(path);
        copied = true;
    } catch {
        copied = false;
    }

    button.setAttribute("aria-label", `${copied ? "Copied" : "Could not copy"} source path ${path}`);
    button.toggleAttribute("data-copy-failed", !copied);
    icons.copy?.classList.add("hidden");
    (copied ? icons.copied : icons.failed)?.classList.remove("hidden");

    window.setTimeout(() => {
        if (!button.isConnected) return;
        button.setAttribute("aria-label", originalLabel);
        button.removeAttribute("data-copy-failed");
        icons.copy?.classList.remove("hidden");
        icons.copied?.classList.add("hidden");
        icons.failed?.classList.add("hidden");
    }, outcomeDuration);
}
