export async function copySourcePath(button: HTMLButtonElement, path: string) {
    const copyIcon = button.querySelector<SVGElement>("[data-copy-icon]");
    const copiedIcon = button.querySelector<SVGElement>("[data-copied-icon]");
    const originalLabel = button.getAttribute("aria-label") ?? "Copy source path";

    try {
        await navigator.clipboard.writeText(path);
        button.setAttribute("aria-label", `Copied source path ${path}`);
        copyIcon?.classList.add("hidden");
        copiedIcon?.classList.remove("hidden");
    } catch {
        button.setAttribute("aria-label", `Failed to copy source path ${path}`);
    }

    window.setTimeout(() => {
        if (!button.isConnected) return;
        button.setAttribute("aria-label", originalLabel);
        copyIcon?.classList.remove("hidden");
        copiedIcon?.classList.add("hidden");
    }, 1800);
}
