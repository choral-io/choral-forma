/**
 * Scroll an in-page reader anchor without allowing native fragment navigation
 * to also scroll the app shell. On compact layouts the document owns scrolling,
 * so callers should retain the native anchor behavior instead.
 */
export function scrollReaderAnchor(anchor: HTMLAnchorElement) {
    const targetId = decodeFragment(anchor.hash);
    if (!targetId) return false;

    const fragmentTarget = findFragmentTarget(document, targetId, anchor.hash.slice(1));
    if (!fragmentTarget) return false;
    const target = footnoteReferenceTarget(fragmentTarget);
    focusReaderTarget(target, anchor.hash);
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
        // An in-page jump must keep the current pathname spelling and query.
        const address = new URL(window.location.href);
        address.hash = anchor.hash;
        window.history.pushState(window.history.state, "", address);
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
    // Honor the target's scroll margin as a native fragment scroll would, so a heading keeps air above it.
    const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const top = Math.max(0, scrollContainer.scrollTop + targetTop - containerTop - margin);
    scrollContainer.scrollTo({ behavior: "auto", top });
    return true;
}

/** Resolve exact ids and heading text before trying a historical ASCII heading id. */
export function findFragmentTarget(root: Document | HTMLElement, id: string, rawId = id) {
    const byId = (candidate: string) =>
        root instanceof Document
            ? root.getElementById(candidate)
            : root.querySelector<HTMLElement>(`[id="${CSS.escape(candidate)}"]`);
    for (const candidate of [id, rawId]) {
        const target = byId(candidate);
        if (target) return target;
    }
    // Match Core's case-insensitive ASCII comparison without folding different
    // headings into the same slug (for example, two Chinese headings into "section").
    const headingText = normalizeHeadingText(id);
    const headings = Array.from(root.querySelectorAll<HTMLElement>("[data-reader-heading-text]"));
    const textOf = (heading: HTMLElement) => normalizeHeadingText(heading.dataset.readerHeadingText ?? "");
    const exactHeading = headings.find((heading) => textOf(heading) === headingText);
    if (exactHeading) return exactHeading;
    if (/\P{ASCII}/u.test(headingText)) {
        // Also accept a hyphenated spelling when all words and Unicode punctuation still match.
        const hyphenated = headingText.replace(/\s+/gu, "-");
        return headings.find((heading) => textOf(heading).replace(/\s+/gu, "-") === hyphenated) ?? null;
    }
    const legacyId = legacyHeadingId(headingText);
    if (!legacyId) return null;
    return (
        byId(legacyId) ??
        headings.find((heading) => {
            const text = textOf(heading);
            return (
                heading.hasAttribute("data-reader-omitted-title") &&
                !/\P{ASCII}/u.test(text) &&
                legacyHeadingId(text) === legacyId
            );
        }) ??
        null
    );
}

function legacyHeadingId(text: string) {
    return text.match(/[a-z0-9]+/gu)?.join("-");
}

function normalizeHeadingText(text: string) {
    return text.trim().replace(/[A-Z]/gu, (letter) => letter.toLowerCase());
}

function decodeFragment(hash: string) {
    if (!hash.startsWith("#") || hash.length === 1) return undefined;
    try {
        return decodeURIComponent(hash.slice(1));
    } catch {
        return undefined;
    }
}

function footnoteReferenceTarget(target: HTMLElement) {
    if (!target.hasAttribute("data-forma-footnote-alias")) return target;
    const reference = target.nextElementSibling;
    return reference instanceof HTMLAnchorElement && reference.matches("a[href][data-user-content-fn-ref]")
        ? reference
        : target;
}

/** Restore deep links after asynchronous reader rendering and history traversal. */
export function restoreReaderFragment(reader: HTMLElement) {
    const id = decodeFragment(window.location.hash);
    if (!id) return;
    const fragmentTarget = document.getElementById(id) ?? findFragmentTarget(reader, id, window.location.hash.slice(1));
    if (!fragmentTarget || !reader.contains(fragmentTarget)) return;
    const target = footnoteReferenceTarget(fragmentTarget);
    focusReaderTarget(target, window.location.hash);
    if (!scrollReaderTarget(target)) target.scrollIntoView({ block: "start" });
}

function focusReaderTarget(target: HTMLElement, expectedHash: string) {
    // Reveal only reader-owned disclosure ancestors; targeting the disclosure itself never toggles it.
    const disclosureParts: HTMLElement[] = [];
    let revealed = false;
    let ancestor = target.parentElement?.closest<HTMLDetailsElement>(
        "details[data-callout-fold], details[data-markdown-disclosure]",
    );
    while (ancestor) {
        if (!ancestor.open) {
            ancestor.open = true;
            revealed = true;
        }
        disclosureParts.push(ancestor);
        const content = ancestor.querySelector<HTMLElement>(":scope > .collapse-content");
        if (content) disclosureParts.push(content);
        ancestor = ancestor.parentElement?.closest<HTMLDetailsElement>(
            "details[data-callout-fold], details[data-markdown-disclosure]",
        );
    }
    const focusTarget =
        target.hasAttribute("data-forma-heading-anchor") && target.parentElement?.matches("h1,h2,h3,h4,h5,h6")
            ? target.parentElement
            : target;
    if (focusTarget.tabIndex < 0 && !focusTarget.hasAttribute("tabindex")) focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
    const disclosureIsAnimating = () =>
        disclosureParts.some(
            (part) =>
                typeof part.getAnimations === "function" &&
                part.getAnimations().some((animation) => animation.pending || animation.playState === "running"),
        );
    if (!disclosureParts.length || (!revealed && document.activeElement === focusTarget && !disclosureIsAnimating())) {
        return;
    }

    const previousFocus = document.activeElement;
    // An opening disclosure can keep its descendants hidden or constrain scrolling until it settles.
    const retryUntil = performance.now() + 500;
    function restoreFocus() {
        if (performance.now() >= retryUntil || !target.isConnected || window.location.hash !== expectedHash) return;
        if (
            target.parentElement?.closest(
                "details[data-callout-fold]:not([open]), details[data-markdown-disclosure]:not([open])",
            )
        ) {
            return;
        }
        // Native fragment navigation may clear the opener's focus to body.
        // Preserve an explicit intervening focus on any other control.
        const active = document.activeElement;
        if (active !== previousFocus && active !== target && active !== focusTarget && active !== document.body) {
            return;
        }
        if (active !== focusTarget) focusTarget.focus({ preventScroll: true });
        if (document.activeElement === focusTarget && !disclosureIsAnimating()) {
            if (!scrollReaderTarget(target)) target.scrollIntoView({ block: "start" });
        } else {
            window.requestAnimationFrame(restoreFocus);
        }
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(restoreFocus));
}
