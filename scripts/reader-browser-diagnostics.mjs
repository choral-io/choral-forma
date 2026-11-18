// These functions are serialized into playwright-cli's isolated run-code environment.
export async function observeReader(page) {
    const network = [];
    const errors = [];
    const failedRequests = [];
    const pending = new Map();
    const documentsByRequest = new WeakMap();
    const mainFrame = page.mainFrame();
    function publicPath(url) {
        const { protocol, origin, pathname } = new URL(url);
        return protocol === "http:" || protocol === "https:" ? origin + pathname : protocol;
    }
    function withoutHash(url) {
        const documentUrl = new URL(url);
        documentUrl.hash = "";
        return documentUrl.href;
    }
    let lastDocumentId = 0;
    let currentDocument = { id: lastDocumentId, url: publicPath(mainFrame.url()) };
    let navigation;
    function keep(list, value) {
        list.push(value);
        if (list.length > 48) list.shift();
    }
    const started = Date.now();
    page.on("request", (request) => {
        if (!["document", "script", "xhr", "fetch", "stylesheet"].includes(request.resourceType())) return;
        const path = publicPath(request.url());
        let owner = currentDocument;
        // A frame can be unavailable for a request emitted before the frame exists.
        let frame;
        if (request.isNavigationRequest()) {
            try {
                frame = request.frame();
            } catch {
                // Keep requests without a frame associated with the last committed document.
            }
        }
        if (frame === mainFrame) {
            const redirect = documentsByRequest.get(request.redirectedFrom());
            owner = { id: redirect?.id ?? ++lastDocumentId, url: path };
            documentsByRequest.set(request, owner);
            navigation = { request, owner };
        }
        const item = { path, type: request.resourceType(), startMs: Date.now() - started, document: owner };
        pending.set(request, item);
        keep(network, item);
    });
    page.on("framenavigated", (frame) => {
        if (frame !== mainFrame || !navigation || withoutHash(frame.url()) !== withoutHash(navigation.request.url())) {
            return;
        }
        currentDocument = navigation.owner;
        navigation = undefined;
    });
    page.on("response", (response) => {
        const item = pending.get(response.request());
        if (item) Object.assign(item, { status: response.status(), headersMs: Date.now() - started });
    });
    function finish(request, failed) {
        const item = pending.get(request);
        if (!item) return;
        item.endMs = Date.now() - started;
        if (failed) item.failure = request.failure()?.errorText;
        if (failed || item.status >= 400) keep(failedRequests, item);
        if (failed && navigation?.request === request) navigation = undefined;
        pending.delete(request);
    }
    page.on("requestfinished", (request) => finish(request, false));
    page.on("requestfailed", (request) => finish(request, true));
    page.on("pageerror", (error) => keep(errors, { ms: Date.now() - started, pageError: error.message.slice(0, 500) }));
    page.on("console", (message) => {
        if (["warning", "error"].includes(message.type()))
            keep(errors, { ms: Date.now() - started, type: message.type(), text: message.text().slice(0, 500) });
    });
    await page.addInitScript(() => {
        const events = [];
        const focusAttempts = [];
        const identity = (node) => node && { tag: node.localName, id: node.id, href: node.getAttribute?.("href") };
        const folds = (node) => {
            const result = [];
            for (let fold = node?.closest?.("details"); fold; fold = fold.parentElement?.closest("details")) {
                result.push({
                    open: fold.open,
                    contentVisibility: getComputedStyle(fold, "::details-content").contentVisibility,
                    animations: fold
                        .getAnimations({ subtree: true })
                        .slice(0, 8)
                        .map((animation) => ({
                            state: animation.playState,
                            pending: animation.pending,
                            time: animation.currentTime,
                        })),
                });
            }
            return result;
        };
        const record = (event) => {
            events.push({ ms: performance.now(), url: location.href, ...event });
            if (events.length > 64) events.shift();
        };
        window.__formaReaderDiagnostic = { events, focusAttempts, folds };
        for (const type of ["focusin", "focusout", "toggle", "transitionend", "transitioncancel"]) {
            document.addEventListener(
                type,
                (event) => {
                    if (type.startsWith("transition") && !event.target.closest?.("details")) return;
                    record({
                        type,
                        target: identity(event.target),
                        related: identity(event.relatedTarget),
                        property: event.propertyName,
                    });
                },
                true,
            );
        }
        // focusin alone misses attempts rejected while ::details-content is hidden.
        const focus = HTMLElement.prototype.focus;
        HTMLElement.prototype.focus = function (...args) {
            if (!this?.matches?.("a[data-user-content-fn-ref]")) return focus.apply(this, args);
            const ms = performance.now();
            const url = location.href;
            const result = focus.apply(this, args);
            // Keep focus calls separately so a burst of transition/focus events cannot evict them.
            focusAttempts.push({
                ms,
                url,
                target: identity(this),
                active: identity(document.activeElement),
                folds: folds(this),
            });
            if (focusAttempts.length > 64) focusAttempts.shift();
            return result;
        };
    });
    return async function snapshot(expectedId) {
        const state = await page
            .evaluate((expectedId) => {
                let hashId = location.hash.slice(1);
                try {
                    hashId = decodeURIComponent(hashId);
                } catch {
                    /* retain malformed fragment */
                }
                const trace = window.__formaReaderDiagnostic;
                const target = document.getElementById(expectedId ?? hashId);
                const main = document.querySelector("main");
                const shell = document.querySelector("[data-enhancement-ready]");
                const bootstrap = document.querySelector("script[data-forma-static-workspace]");
                let artifactId;
                if (bootstrap) {
                    try {
                        artifactId = JSON.parse(bootstrap.textContent).artifactId;
                    } catch {
                        artifactId = "invalid bootstrap JSON";
                    }
                }
                return {
                    artifactId,
                    timeOrigin: performance.timeOrigin,
                    readyState: document.readyState,
                    documentFocused: document.hasFocus(),
                    enhanced: !!shell,
                    route: shell?.getAttribute("data-workspace-route"),
                    fallback: !!document.querySelector("[data-static-fallback]"),
                    notices: [...document.querySelectorAll('[role="status"], [role="alert"]')]
                        .slice(0, 8)
                        .map((node) => node.textContent.trim().slice(0, 200)),
                    heading: main?.querySelector("h1")?.textContent,
                    readerLoading: !!document.querySelector("[data-reader-loading]"),
                    targetId: expectedId ?? hashId,
                    target: target?.outerHTML.slice(0, 300),
                    bounds: target?.getBoundingClientRect().toJSON(),
                    mainBounds: main?.getBoundingClientRect().toJSON(),
                    viewport: [innerWidth, innerHeight],
                    readerScroll: main?.scrollTop,
                    shellScroll: document.querySelector("[data-workspace-shell]")?.scrollTop,
                    active: document.activeElement?.outerHTML.slice(0, 300),
                    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
                    folds: trace?.folds(target),
                    events: trace?.events,
                    focusAttempts: trace?.focusAttempts,
                };
            }, expectedId)
            .catch((error) => ({ captureError: error.message }));
        return {
            started,
            url: page.url(),
            document: currentDocument,
            state,
            network: [...network],
            pending: [...pending.values()].slice(-48),
            errors: [...errors],
            failedRequests: [...failedRequests],
        };
    };
}

export function sectionHeading(page, id, name) {
    // Intersect by DOM id and exact accessible name. The permalink button contributes to textContent.
    return page
        .locator("[data-enhancement-ready] main")
        .getByRole("heading", { name, exact: true })
        .and(page.locator(`[id=${JSON.stringify(id)}]`));
}
