/**
 * Reading controls added to a mounted reader: a copy control on every code block
 * and a copy-link control on every heading. They are built in the DOM because the
 * reader body is sanitized HTML rather than a React tree.
 */
const copyIconPaths = [
    "M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z",
    "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
] as const;
const checkIconPaths = ["M20 6 9 17l-5-5"] as const;
const failedIconPaths = ["M18 6 6 18", "m6 6 12 12"] as const;

const copiedDuration = 1800;
const codeCopyLabel = "Copy code";
const headingSelector = "h1, h2, h3, h4, h5, h6";
// Class constants, rather than inline `.className` strings, so the style lint checks them.
const codeCopyHostClassName = "relative";
const codeCopyButtonClassName =
    "btn btn-square btn-ghost btn-xs bg-base-100/80 absolute inset-e-2 top-3 opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 data-copy-failed:text-error";
let headingLabelCount = 0;

export function enhanceReader(reader: HTMLElement): () => void {
    const restore: (() => void)[] = [];
    const timers = new Set<number>();

    for (const pre of reader.querySelectorAll("pre")) {
        // Diagram source is not a code sample: it stays as rendered, both in a diagram's
        // source disclosure and as the fallback for a diagram that could not be drawn.
        if (pre.querySelector(":scope > code.language-mermaid")) continue;
        // A highlighted block already sits in a positioned wrapper that carries its language label.
        let host = pre.parentElement;
        if (!host?.hasAttribute("data-code-block") || host === reader) {
            const wrapper = document.createElement("div");
            wrapper.className = codeCopyHostClassName;
            pre.replaceWith(wrapper);
            wrapper.append(pre);
            host = wrapper;
            restore.push(() => {
                wrapper.replaceWith(pre);
            });
        }
        const owner = host;
        owner.classList.add("group/code");
        const button = document.createElement("button");
        button.type = "button";
        button.className = codeCopyButtonClassName;
        button.dataset.readerCopyCode = "";
        button.ariaLabel = codeCopyLabel;
        button.title = codeCopyLabel;
        button.append(createIcon(copyIconPaths));
        owner.append(button);
        restore.push(() => {
            button.remove();
            owner.classList.remove("group/code");
        });
    }

    for (const heading of reader.querySelectorAll<HTMLElement>(headingSelector)) {
        const id = heading.querySelector("[data-forma-heading-anchor]")?.id;
        if (!id) continue;
        // The heading keeps naming itself from its own content, so the control does not become part of its name.
        const label = document.createElement("span");
        label.id = `reader-heading-label-${String((headingLabelCount += 1))}`;
        // Anchors stay direct children: fragment navigation focuses the heading that owns one.
        label.append(
            ...[...heading.childNodes].filter(
                (node) => !(node instanceof HTMLElement && node.hasAttribute("data-forma-heading-anchor")),
            ),
        );
        const labelledBy = heading.getAttribute("aria-labelledby");
        heading.setAttribute("aria-labelledby", label.id);
        // A button rather than a link: it copies an address, and the document's own links stay the only links.
        const link = document.createElement("button");
        link.type = "button";
        link.dataset.readerHeadingLink = id;
        link.ariaLabel = "Copy link to this section";
        link.title = "Copy link to this section";
        link.textContent = "#";
        heading.append(label, link);
        restore.push(() => {
            link.remove();
            label.replaceWith(...label.childNodes);
            if (labelledBy === null) heading.removeAttribute("aria-labelledby");
            else heading.setAttribute("aria-labelledby", labelledBy);
        });
    }

    // The outcome shows for a moment either way: a control that silently does nothing reads as broken.
    function markOutcome(control: HTMLElement, copied: boolean, outcomeLabel: string, reset: () => void) {
        const label = control.ariaLabel;
        const state = copied ? "data-copied" : "data-copy-failed";
        control.ariaLabel = outcomeLabel;
        control.setAttribute(state, "");
        const timer = window.setTimeout(() => {
            timers.delete(timer);
            control.ariaLabel = label;
            control.removeAttribute(state);
            reset();
        }, copiedDuration);
        timers.add(timer);
    }

    const isShowingOutcome = (control: HTMLElement) => "copied" in control.dataset || "copyFailed" in control.dataset;

    function handleClick(event: MouseEvent) {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest<HTMLButtonElement>("[data-reader-copy-code]");
        if (button) {
            if (isShowingOutcome(button)) return;
            const code = button.parentElement?.querySelector("pre")?.textContent ?? "";
            void copyText(code).then((copied) => {
                if (!button.isConnected) return;
                button.replaceChildren(createIcon(copied ? checkIconPaths : failedIconPaths));
                markOutcome(button, copied, copied ? "Code copied" : "Could not copy code", () => {
                    button.replaceChildren(createIcon(copyIconPaths));
                });
            });
            return;
        }

        const link = event.target.closest<HTMLButtonElement>("[data-reader-heading-link]");
        if (link && !isShowingOutcome(link)) {
            const address = new URL(window.location.href);
            address.hash = link.dataset.readerHeadingLink ?? "";
            void copyText(address.href).then((copied) => {
                if (!link.isConnected) return;
                link.textContent = copied ? "✓" : "✕";
                markOutcome(link, copied, copied ? "Section link copied" : "Could not copy section link", () => {
                    link.textContent = "#";
                });
            });
        }
    }

    reader.addEventListener("click", handleClick);
    return () => {
        reader.removeEventListener("click", handleClick);
        for (const timer of timers) window.clearTimeout(timer);
        for (const undo of restore.reverse()) undo();
    };
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

function createIcon(paths: readonly string[]) {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("fill", "none");
    icon.setAttribute("height", "14");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "14");
    for (const pathData of paths) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        icon.append(path);
    }
    return icon;
}
