export const staticNavigationBrowserAssertions = 24;

/** Runs in Playwright's isolated browser runner against the generated fixture. */
export async function runStaticNavigationFailureScenarios(parentPage, { origin, root, base, fixture }) {
    let assertions = 0;
    const assert = (condition, message) => {
        if (!condition) throw new Error(message);
        assertions++;
    };
    const prefix = root === "/" ? "" : root;
    const home = origin + (prefix || "/");
    const suffix = "?keep=1&keep=2#fixture-section";
    const targetPage = origin + prefix + fixture.target + suffix;
    const alternatePage = origin + prefix + fixture.otherPath;
    const entryRequest = origin + base + "/" + fixture.dataPath;
    const manifestRequest = origin + base + "/dashboard.json";
    const rpcRequests = [];
    const detailStatus = [];
    const pageErrors = [];
    let phase;
    const onRequest = (request) => {
        if (new URL(request.url()).pathname.endsWith("/-/rpc")) rpcRequests.push(request.url());
    };
    const onResponse = (response) => {
        if (response.url() === entryRequest) detailStatus.push({ phase, status: response.status() });
    };
    const onPageError = (error) => pageErrors.push(error.message);
    let page;
    async function newPage() {
        await page?.close();
        page = await parentPage.context().newPage();
        page.setDefaultTimeout(10_000);
        page.on("request", onRequest);
        page.on("response", onResponse);
        page.on("pageerror", onPageError);
    }

    const source = () => page.getByRole("link", { name: "Cloudflare fixture link", exact: true });
    const alternate = () => page.getByRole("link", { name: "Cloudflare alternate link", exact: true });
    const failure = () => page.locator("[data-workspace-route-failure]:visible");
    const retry = () => failure().getByRole("button", { name: "Retry", exact: true });
    const openStatic = () => failure().getByRole("link", { name: "Open static page", exact: true });
    const waitForRoute = (routePath) =>
        page.waitForFunction(
            (path) => document.querySelector("[data-enhancement-ready]")?.getAttribute("data-workspace-route") === path,
            routePath,
        );
    const openHome = async () => {
        await page.goto(home);
        await waitForRoute("/");
        await source().waitFor();
    };
    const historyLength = () => page.evaluate(() => history.length);
    const survey = () =>
        page.evaluate(() => ({
            href: location.href,
            length: history.length,
            focus: document.activeElement?.textContent,
            scroll: document.querySelector("main")?.scrollTop,
            title: document.querySelector("main h1")?.textContent,
        }));
    const gate = () => {
        let release;
        const response = new Promise((resolve) => {
            release = resolve;
        });
        return { response, release };
    };

    try {
        await newPage();
        for (const mutation of ["404", "schema", "artifact"]) {
            phase = `B1 initial ${mutation}`;
            const corruptManifest = async (route) => {
                if (mutation === "404") return route.fulfill({ status: 404, body: "Fixture manifest unavailable" });
                const response = await route.fetch();
                const json = await response.json();
                if (mutation === "schema") json.schemaVersion += 1;
                else json.artifactId = "0".repeat(64);
                return route.fulfill({ response, json });
            };
            await page.route(manifestRequest, corruptManifest);
            try {
                await page.goto(home);
                await page.getByRole("status").filter({ hasText: "Interactive navigation could not load" }).waitFor();
                assert(
                    (await page.locator("[data-static-fallback]").count()) === 1 &&
                        (await page.locator("[data-enhancement-ready]").count()) === 0 &&
                        page.url() === home,
                    `B1 ${mutation}: a rejected enhancement replaced the generated document`,
                );
            } finally {
                await page.unroute(manifestRequest, corruptManifest);
            }
        }

        for (const mutation of ["offline", "404", "identity", "artifact"]) {
            phase = `B2 click ${mutation}`;
            let attempts = 0;
            let allow = false;
            const retryGate = gate();
            const entryDetail = async (route) => {
                attempts++;
                if (allow) {
                    await retryGate.response;
                    return route.continue();
                }
                if (mutation === "offline") return route.abort("internetdisconnected");
                if (mutation === "404") return route.fulfill({ status: 404, body: "Fixture entry missing" });
                const response = await route.fetch();
                const json = await response.json();
                if (mutation === "identity") json.path = "notes/wrong.md";
                else json.artifactId = "0".repeat(64);
                return route.fulfill({ response, json });
            };
            await openHome();
            await page.route(entryRequest, entryDetail);
            try {
                await source().scrollIntoViewIfNeeded();
                await source().focus();
                const before = await survey();
                await source().click();
                await failure().waitFor();
                const after = await survey();
                assert(
                    Object.keys(before).every((key) => before[key] === after[key]),
                    `B2 ${mutation}: unsuccessful click changed source URL, history, body, scroll or focus: ${JSON.stringify({ before, after })}`,
                );
                allow = true;
                await retry().evaluate((button) => {
                    button.click();
                    button.click();
                });
                retryGate.release();
                await page.waitForURL(targetPage);
                await page.waitForFunction(() => document.activeElement?.id === "fixture-section");
                assert(
                    (await historyLength()) === before.length + 1 && attempts === 2 && (await failure().count()) === 0,
                    `B2 ${mutation}: retry added the wrong number of history entries or requests`,
                );
            } finally {
                retryGate.release();
                await page.unroute(entryRequest, entryDetail);
            }
        }

        phase = "B3 uncached POP and retry";
        await newPage();
        await openHome();
        await page.evaluate(
            ({ targetPage, home }) => {
                // Create an uncached same-document entry, then exercise native browser history traversal.
                const current = history.state;
                history.pushState({ ...current, idx: current.idx + 1 }, "", targetPage);
                history.pushState({ ...current, idx: current.idx + 2 }, "", home);
            },
            { targetPage, home },
        );
        const popLength = await historyLength();
        const popGate = gate();
        let failPop = true;
        const popDetail = async (route) => {
            if (!failPop) return route.continue();
            await popGate.response;
            return route.fulfill({ status: 404, body: "Uncached history entry" });
        };
        await page.route(entryRequest, popDetail);
        try {
            await page.evaluate(() => history.back());
            await page.waitForURL(targetPage);
            await page.getByRole("status", { name: "Loading workspace route" }).waitFor();
            assert(
                (await source().count()) === 0 && (await historyLength()) === popLength,
                "B3: pending POP left the previous page visible or changed history length",
            );
            popGate.release();
            await failure().waitFor();
            assert(page.url() === targetPage && (await source().count()) === 0, "B3: failed POP showed the wrong page");
            failPop = false;
            phase = "B3 cached forward and back";
            await retry().click();
            await waitForRoute(fixture.target);
            await page.waitForFunction(() => document.activeElement?.id === "fixture-section");
            await page.evaluate(() => history.forward());
            await page.waitForURL(home);
            await waitForRoute("/");
            await page.evaluate(() => history.back());
            await waitForRoute(fixture.target);
            assert((await historyLength()) === popLength, "B3: retry or history traversal added another entry");
        } finally {
            popGate.release();
            await page.unroute(entryRequest, popDetail);
        }

        phase = "B3 uncached POP and complete reload";
        await newPage();
        await openHome();
        await page.evaluate(
            ({ targetPage, home }) => {
                const current = history.state;
                history.pushState({ ...current, idx: current.idx + 1 }, "", targetPage);
                history.pushState({ ...current, idx: current.idx + 2 }, "", home);
            },
            { targetPage, home },
        );
        const reloadLength = await historyLength();
        const rejectPop = (route) => route.fulfill({ status: 404, body: "Uncached history entry" });
        await page.route(entryRequest, rejectPop);
        try {
            await page.evaluate(() => history.back());
            await failure().waitFor();
        } finally {
            await page.unroute(entryRequest, rejectPop);
        }
        const completeReload = page.waitForRequest(
            (request) => request.url() === targetPage.split("#")[0] && request.isNavigationRequest(),
        );
        await openStatic().click();
        await completeReload;
        await waitForRoute(fixture.target);
        assert(
            page.url() === targetPage && (await historyLength()) === reloadLength,
            "B3: opening static page added a history entry",
        );

        for (const outcome of ["success", "failure"]) {
            phase = `B4 superseded ${outcome}`;
            await openHome();
            const startingHistory = await historyLength();
            const late = gate();
            const lateRequested = gate();
            const lateCompleted = gate();
            let requests = 0;
            const delayed = async (route) => {
                requests++;
                lateRequested.release();
                await late.response;
                try {
                    if (outcome === "success") await route.continue();
                    else await route.fulfill({ status: 404, body: "Discardable late failure" });
                } finally {
                    lateCompleted.release();
                }
            };
            await page.route(entryRequest, delayed);
            try {
                await source().evaluate((link) => {
                    link.click();
                    link.click();
                });
                await lateRequested.response;
                await alternate().click();
                await page.waitForURL(alternatePage);
                await waitForRoute(fixture.otherPath);
                const delivered = page.waitForResponse(entryRequest);
                late.release();
                await lateCompleted.response;
                await (await delivered).finished();
                await page.evaluate(
                    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
                );
                assert(
                    requests === 1 &&
                        page.url() === alternatePage &&
                        (await historyLength()) === startingHistory + 1 &&
                        (await failure().count()) === 0,
                    `B4: duplicate click or late ${outcome} replaced the newer route`,
                );
            } finally {
                late.release();
                await page.unroute(entryRequest, delayed);
            }
        }

        phase = "B5 directory introduction";
        await openHome();
        await page.getByRole("link", { name: "Cloudflare directory link", exact: true }).click();
        await waitForRoute("/notes");
        await page.waitForFunction(() => document.activeElement?.id === "directory-section");
        await page.getByRole("link", { name: "notes/index.md", exact: true }).waitFor();
        await page.getByRole("list", { name: "Pages", exact: true }).waitFor();
        assert(new URL(page.url()).search === "?keep=1&keep=2", "B5: directory intro changed the repeated query");

        phase = "B5 language variant";
        await openHome();
        await page.getByRole("link", { name: "Cloudflare variant link", exact: true }).click();
        await waitForRoute(fixture.variantPath);
        await page.waitForFunction(() => document.activeElement?.id === "fixture-section");
        assert(new URL(page.url()).search === "?keep=1&keep=2", "B5: variant changed the repeated query");

        phase = "B5 View";
        await openHome();
        const viewLink = page
            .locator(`a[href="${prefix + fixture.viewPath}"]`)
            .filter({ visible: true })
            .first();
        await viewLink.click();
        await waitForRoute(fixture.viewPath);
        await page.getByRole("heading", { level: 1, name: fixture.viewTitle, exact: true }).waitFor();
        assert(
            page.url() === origin + prefix + fixture.viewPath,
            "B5: View link did not reach the projected public route",
        );

        phase = "B5 footnote backreference";
        await openHome();
        await source().click();
        await page.waitForURL(targetPage);
        const footnote = page.locator("main a[data-user-content-fn-ref]").first();
        const noteRef = await footnote.getAttribute("id");
        await footnote.click();
        await page.locator("main a[data-footnote-backref]").first().click();
        await page.waitForFunction((id) => document.activeElement?.id === id, noteRef);
        assert(
            new URL(page.url()).search === "?keep=1&keep=2",
            "B5: footnote backreference changed the repeated query",
        );

        phase = "B2 narrow sidebar retry";
        await newPage();
        await page.setViewportSize({ width: 390, height: 720 });
        await openHome();
        const rejectMobile = (route) => route.fulfill({ status: 404, body: "Fixture sidebar entry missing" });
        await page.route(entryRequest, rejectMobile);
        const oldLength = await historyLength();
        const drawer = page.getByRole("dialog", { name: "Workspace navigation" });
        await page.getByRole("button", { name: "Open workspace navigation" }).click();
        const mobileTarget = drawer.getByRole("link", { name: "Fixture Exact Note", exact: true });
        if (!(await mobileTarget.isVisible())) {
            await drawer.getByRole("button", { name: "Show contents of Fixture Directory Introduction" }).click();
        }
        await mobileTarget.click();
        const drawerRetry = drawer.getByRole("button", { name: "Retry", exact: true });
        await drawerRetry.waitFor();
        assert(
            page.url() === home &&
                (await historyLength()) === oldLength &&
                (await mobileTarget.evaluate((link) => link === document.activeElement)),
            "B2: unsuccessful narrow sidebar click changed source focus, address, or history",
        );
        await page.unroute(entryRequest, rejectMobile);
        await drawerRetry.click();
        await drawer.waitFor({ state: "hidden" });
        await waitForRoute(fixture.target);
        assert(
            page.url() === origin + prefix + fixture.target && (await historyLength()) === oldLength + 1,
            "B2: retry inside narrow navigation did not commit exactly one page",
        );
        assert(rpcRequests.length === 0, "Enhanced/static fallback navigations attempted RPC");
        return assertions;
    } catch (error) {
        const diagnostics = await page
            ?.evaluate(() => ({
                route: document.querySelector("[data-workspace-shell]")?.getAttribute("data-workspace-route"),
                status: document.querySelector("main")?.getAttribute("aria-label"),
                failures: document.querySelectorAll("[data-workspace-route-failure]").length,
                history: history.state,
            }))
            .catch(() => undefined);
        throw new Error(
            `${phase}: ${error.message}\n${JSON.stringify({ url: page?.url(), diagnostics, detailStatus, pageErrors })}`,
            { cause: error },
        );
    } finally {
        await page?.close();
    }
}
