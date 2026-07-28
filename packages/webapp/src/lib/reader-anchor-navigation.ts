/**
 * Scroll an in-page reader anchor without allowing native fragment navigation
 * to also scroll the app shell. On compact layouts the document owns scrolling,
 * so callers should retain the native anchor behavior instead.
 */
export function scrollReaderAnchor(anchor: HTMLAnchorElement) {
    const targetId = decodeFragment(anchor.hash);
    if (!targetId) return false;

    const target = document.getElementById(targetId);
    if (!target || !scrollReaderTarget(target)) return false;

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
