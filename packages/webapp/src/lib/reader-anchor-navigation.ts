/**
 * Scroll an in-page reader anchor without allowing native fragment navigation
 * to also scroll the app shell. On compact layouts the document owns scrolling,
 * so callers should retain the native anchor behavior instead.
 */
export function scrollReaderAnchor(anchor: HTMLAnchorElement) {
    const targetId = decodeFragment(anchor.hash);
    if (!targetId) return false;

    const target = document.getElementById(targetId) ?? document.getElementById(anchor.hash.slice(1));
    if (!target) return false;
    focusReaderTarget(target);
    if (!scrollReaderTarget(target)) {
        // Static directory hosts add a trailing slash. Following the canonical
        // href natively would reload the document instead of moving its fragment.
        if (
            anchor.pathname !== window.location.pathname &&
            anchor.pathname.replace(/\/$/u, "") === window.location.pathname.replace(/\/$/u, "")
        ) {
            window.location.hash = anchor.hash;
            return true;
        }
        return false;
    }

    if (window.location.hash !== anchor.hash) {
        window.history.pushState(window.history.state, "", anchor.href);
    }
    return true;
}

function scrollReaderTarget(target: HTMLElement) {
    const scrollContainer = target.closest<HTMLElement>("main");
    if (!scrollContainer || scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
        return false;
    }

    const targetTop = target.getBoundingClientRect().top;
    const containerTop = scrollContainer.getBoundingClientRect().top;
    const top = Math.max(0, scrollContainer.scrollTop + targetTop - containerTop);
    scrollContainer.scrollTo({ behavior: "auto", top });
    return true;
}

function decodeFragment(hash: string) {
    if (!hash.startsWith("#") || hash.length === 1) return undefined;
    try {
        return decodeURIComponent(hash.slice(1));
    } catch {
        return undefined;
    }
}

/** Restore deep links after asynchronous reader rendering and history traversal. */
export function restoreReaderFragment(reader: HTMLElement) {
    const id = decodeFragment(window.location.hash);
    if (!id) return;
    const target = document.getElementById(id) ?? document.getElementById(window.location.hash.slice(1));
    if (!target || !reader.contains(target)) return;
    focusReaderTarget(target);
    if (!scrollReaderTarget(target)) target.scrollIntoView({ block: "start" });
}

function focusReaderTarget(target: HTMLElement) {
    // Reveal only Forma callout ancestors; navigating to a disclosure itself does not toggle it.
    let revealed = false;
    let ancestor = target.parentElement?.closest<HTMLDetailsElement>("details[data-callout-fold]");
    while (ancestor) {
        if (!ancestor.open) {
            ancestor.open = true;
            revealed = true;
        }
        ancestor = ancestor.parentElement?.closest<HTMLDetailsElement>("details[data-callout-fold]");
    }
    const focusTarget =
        target.hasAttribute("data-forma-heading-anchor") && target.parentElement?.matches("h1,h2,h3,h4,h5,h6")
            ? target.parentElement
            : target;
    if (!focusTarget.hasAttribute("tabindex")) focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
    if (revealed && document.activeElement !== focusTarget) {
        const previousFocus = document.activeElement;
        // Native disclosure descendants can become focusable after the first expanded paint.
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (!target.isConnected || decodeFragment(window.location.hash) !== target.id) return;
                if (target.parentElement?.closest("details[data-callout-fold]:not([open])")) return;
                if (document.activeElement !== previousFocus && document.activeElement !== target) return;
                focusTarget.focus({ preventScroll: true });
                if (!scrollReaderTarget(target)) target.scrollIntoView({ block: "start" });
            });
        });
    }
}
