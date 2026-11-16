/** Runs against real WebApp/static hosts; serialized into playwright-cli's isolated runner. */
export async function markdownBrowserScenarios(page, options) {
    const assert = (condition, message) => {
        if (!condition) throw new Error(message);
    };
    const results = [];
    const sourceCases = {};
    const browser = page.context().browser();
    const failure = async (current, name, error, diagnostics = {}) => {
        let screenshotError;
        try {
            await current.screenshot({
                path: `${options.artifacts}/${name}-failure.png`,
                fullPage: true,
                timeout: 5000,
            });
        } catch (captureError) {
            screenshotError = captureError.message;
        }
        const navigation = await current
            .evaluate(() => ({
                active: document.activeElement?.outerHTML.slice(0, 500),
                documentFocused: document.hasFocus(),
                target: document
                    .getElementById("forma-heading-hidden-interaction-heading")
                    ?.parentElement?.outerHTML.slice(0, 1200),
            }))
            .catch(() => undefined);
        throw new Error(
            `${error.stack ?? error}\nDiagnostics: ${JSON.stringify({ url: current.url(), ...diagnostics, screenshotError, navigation })}`,
        );
    };
    const footnoteBackref = (current, id) =>
        current.locator(`a[data-footnote-backref][href$="#${encodeURIComponent(id)}"]`);
    const expectFootnoteLanding = async (current, label, { id, fragment = id, search = "", foldCount }) => {
        try {
            await current.locator("[data-enhancement-ready]").waitFor();
            await current.waitForFunction(
                ({ id, fragment, search, foldCount }) => {
                    const reference = document.getElementById(id);
                    if (
                        !(reference === document.activeElement && reference?.matches("a[data-user-content-fn-ref]")) ||
                        decodeURIComponent(location.hash.slice(1)) !== fragment ||
                        location.search !== search ||
                        matchMedia("(prefers-reduced-motion: reduce)").matches
                    ) {
                        return false;
                    }
                    let count = 0;
                    for (let ancestor = reference.parentElement; ancestor; ancestor = ancestor.parentElement) {
                        if (!ancestor.matches("details[data-callout-fold], details[data-markdown-disclosure]"))
                            continue;
                        if (
                            !ancestor.open ||
                            ancestor
                                .getAnimations({ subtree: true })
                                .some((animation) => animation.pending || animation.playState === "running")
                        ) {
                            return false;
                        }
                        count++;
                    }
                    const bounds = reference.getBoundingClientRect();
                    const reader = reference.closest("main")?.getBoundingClientRect();
                    return (
                        count === foldCount &&
                        reference.closest("[data-workspace-shell]")?.scrollTop === 0 &&
                        reader &&
                        bounds.height > 0 &&
                        bounds.top >= Math.max(reader.top, 0) - 1 &&
                        bounds.bottom <= Math.min(reader.bottom, innerHeight) + 1
                    );
                },
                { id, fragment, search, foldCount },
                { timeout: 3000 },
            );
        } catch (error) {
            const position = await current
                .evaluate((id) => {
                    const reference = document.getElementById(id);
                    return {
                        reference: reference?.getBoundingClientRect().toJSON(),
                        reader: reference?.closest("main")?.getBoundingClientRect().toJSON(),
                        shellScrollTop: reference?.closest("[data-workspace-shell]")?.scrollTop,
                    };
                }, id)
                .catch(() => undefined);
            throw new Error(`${label}: ${error.message} ${JSON.stringify(position)}`, { cause: error });
        }
    };
    const rawSource = async (current, host, noScript = false) => {
        await current.goto(`${host.origin}${host.root}/notes/raw-source.txt/`);
        if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
        // Scoped to the document: the sidebar titles that directory with the same "Directory entry" heading.
        const directory = current
            .locator('[data-reader="markdown"]')
            .getByRole("link", { name: "Directory entry", exact: true });
        const directoryHref = `${host.root}/notes/resource-directory.txt#details`;
        assert(
            (await directory.getAttribute("href")) === directoryHref,
            "static: directory alias rewritten as raw resource",
        );
        await directory.click();
        await current.waitForURL(
            (url) =>
                url.pathname.replace(/\/$/u, "") === `${host.root}/notes/resource-directory.txt` &&
                url.hash === "#details",
        );
        await current
            .locator('[data-reader="markdown"]:not([data-reader-loading])')
            .getByText("Directory alias content.", { exact: true })
            .waitFor();
        assert(
            (await current.locator('[data-reader="markdown"]').textContent()).includes("Directory alias content."),
            "static: directory alias content missing",
        );
        await current.goto(`${host.origin}${host.root}/notes/raw-source.txt/`);
        if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
        const original = current
            .locator('[data-reader="markdown"]')
            .getByRole("link", { name: "Original source", exact: true });
        const href = `${host.root}/-/raw/notes/raw-source.txt?download=1#part`;
        assert((await original.getAttribute("href")) === href, "static: raw source shadowed by sidecar");
        const responseReady = current.waitForResponse(
            (response) =>
                response.request().isNavigationRequest() && response.url().includes("/-/raw/notes/raw-source.txt"),
        );
        await original.click();
        const response = await responseReady;
        await current.waitForURL(`${host.origin}${href}`);
        assert(response.ok(), "static: raw source response failed");
        assert(response.headers()["content-type"]?.startsWith("text/plain"), "static: raw source MIME changed");
        assert(
            (await current.locator("body").textContent()).includes("FORMA_RAW_SOURCE_BROWSER_PROBE"),
            "static: raw source content missing",
        );
        assert(
            (await current.locator('[data-reader="markdown"]').count()) === 0,
            "static: raw source intercepted by SPA",
        );
    };
    const nativeDisclosures = async (current, host, noScript = false) => {
        assert(options.disclosureCases?.length > 0, `${host.name}: disclosure cases missing`);
        const completed = [];
        for (const fixture of options.disclosureCases) {
            await current.goto(`${host.origin}${host.root}/notes/fold-${fixture.id}/`);
            if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
            const reader = current.locator('[data-reader="markdown"]:not([data-reader-loading]):not([role="alert"])');
            await reader.waitFor({ state: "attached" });
            const actual = await reader.locator("details[data-markdown-disclosure]").evaluateAll((nodes) =>
                nodes.map((fold) => ({
                    title: fold.querySelector(":scope > summary")?.textContent,
                    open: fold.open,
                })),
            );
            assert(
                JSON.stringify(actual.map((fold) => fold.title)) === JSON.stringify(fixture.titles),
                `${host.name}: ${fixture.id} titles: ${JSON.stringify(actual)}`,
            );
            assert(
                JSON.stringify(actual.map((fold) => fold.open)) === JSON.stringify(fixture.opens),
                `${host.name}: ${fixture.id} defaults`,
            );
            assert(
                (await reader.locator("details:not([data-markdown-disclosure]):not([data-callout-fold])").count()) ===
                    0,
                `${host.name}: ${fixture.id} unsafe disclosure`,
            );
            for (const [selector, expected] of Object.entries(fixture.selectors)) {
                if (selector === "h2") continue; // The fallback footnote heading is compiler-specific.
                const count = await reader
                    .locator(selector)
                    .evaluateAll(
                        (nodes) => nodes.filter((node) => !node.closest("[data-markdown-sticky-header]")).length,
                    );
                assert(count === expected, `${host.name}: ${fixture.id} ${selector}`);
            }
            assert(
                (await reader.locator("script,iframe,[onclick],[onerror]").count()) === 0,
                `${host.name}: ${fixture.id} unsafe markup`,
            );
            for (const literal of fixture.literals)
                assert((await reader.textContent()).includes(literal), `${host.name}: ${fixture.id} missing literal`);
            completed.push(fixture.id);
        }
        const pageUrl = `${host.origin}${host.root}/notes/disclosures/`;
        await current.goto(pageUrl);
        if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
        if (noScript) {
            assert(
                await current.evaluate(() => {
                    const script = document.createElement("script");
                    script.textContent = "window.__formaDisclosureScriptProbe = true";
                    document.head.append(script);
                    return window.__formaDisclosureScriptProbe !== true;
                }),
                "noscript: disclosure context unexpectedly executes scripts",
            );
        }
        const folds = current.locator('[data-reader="markdown"] details[data-markdown-disclosure]');
        await folds.first().waitFor({ state: "attached" });
        assert((await folds.count()) === 3, `${host.name}: disclosure sample structure`);
        const content = current.locator('[data-reader="markdown"]');
        assert((await content.locator(".katex").count()) === (noScript ? 0 : 2), `${host.name}: folded formulae`);
        for (const selector of ["mark", "del", "details[data-callout-fold]", "pre"]) {
            assert((await content.locator(selector).count()) === 1, `${host.name}: folded ${selector}`);
        }
        if (noScript) assert((await content.textContent()).includes("$x^2$"), "noscript: folded formula source");
        const outer = folds.nth(0),
            inner = folds.nth(1),
            summary = outer.locator(":scope > summary");
        const jumpToHidden = current.getByRole("link", { name: /^Jump to hidden heading/ });
        const open = async (fold) => fold.evaluate((fold) => fold.open);
        assert(
            !(await open(outer)) && !(await open(inner)) && (await open(folds.nth(2))),
            `${host.name}: sample defaults`,
        );
        await summary.click();
        assert(await open(outer), `${host.name}: pointer open`);
        await summary.focus();
        await current.keyboard.press("Space");
        assert(!(await open(outer)), `${host.name}: keyboard close`);
        await current.keyboard.press("Enter");
        assert(await open(outer), `${host.name}: keyboard open`);
        await summary.click();
        if (!noScript) {
            await jumpToHidden.click();
            await current.waitForFunction(() => document.activeElement?.tagName === "H2");
            assert((await open(outer)) && (await open(inner)), `${host.name}: nested ancestors not revealed`);
            assert(
                await current.locator("details[data-callout-fold]").evaluate((fold) => !fold.open),
                `${host.name}: unrelated callout changed`,
            );
            const returnId = await inner.locator(".collapse-content sup a").first().getAttribute("id");
            assert(returnId === "user-content-fnref-folded:1", `${host.name}: encoded second footnote reference ID`);
            const landing = { id: returnId, foldCount: 2 };
            await outer.evaluate((fold) => {
                fold.open = false;
                for (const child of fold.querySelectorAll("details[data-markdown-disclosure]")) child.open = false;
            });
            await footnoteBackref(current, returnId).click();
            await expectFootnoteLanding(current, `${host.name}: second nested footnote return`, landing);
            for (const fragment of [returnId, "user-content-fnref-folded-2"]) {
                await current.goto("about:blank");
                await current.goto(`${pageUrl}#${encodeURIComponent(fragment)}`);
                const target = { ...landing, fragment };
                await expectFootnoteLanding(current, `${host.name}: nested footnote direct ${fragment}`, target);
                await current.reload();
                await expectFootnoteLanding(current, `${host.name}: nested footnote refresh ${fragment}`, target);
            }
            await current.goto(`${pageUrl}#forma-heading-hidden-fold-heading`);
            await current.waitForFunction(() => document.activeElement?.tagName === "H2");
            await outer.evaluate((fold) => {
                fold.open = false;
                for (const child of fold.querySelectorAll("details[data-markdown-disclosure]")) child.open = false;
            });
            await jumpToHidden.click();
            assert((await open(outer)) && (await open(inner)), `${host.name}: same-fragment reveal`);
        } else {
            await summary.click();
            await inner.locator(":scope > summary").click();
            await inner.locator("h2").waitFor({ state: "visible" });
            assert(await open(inner), "noscript: nested disclosure did not open");
        }
        for (const width of [1280, 390])
            for (const scheme of ["light", "dark"]) {
                await current.setViewportSize({ width, height: 900 });
                await current.evaluate(
                    (scheme) => document.documentElement.setAttribute("data-theme", `choral-${scheme}`),
                    scheme,
                );
                // Tab into the summary so the browser applies its keyboard focus indicator.
                await jumpToHidden.focus();
                await current.keyboard.press("Tab");
                const geometry = await summary.evaluate((summary) => ({
                    focused: summary === document.activeElement,
                    focusVisible: summary.matches(":focus-visible"),
                    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                    labelOverflow: summary.scrollWidth > summary.clientWidth + 1,
                    outline: getComputedStyle(summary).outlineStyle,
                }));
                assert(!geometry.overflow && !geometry.labelOverflow, `${host.name}: disclosure overflow at ${width}`);
                assert(
                    geometry.focused && geometry.focusVisible && geometry.outline !== "none",
                    `${host.name}: missing keyboard focus: ${JSON.stringify(geometry)}`,
                );
                await current.screenshot({
                    path: `${options.artifacts}/${host.name}-disclosures-${width}-${scheme}${noScript ? "-noscript" : ""}.png`,
                    fullPage: true,
                });
            }
        await current.setViewportSize({ width: 1280, height: 900 });
        return completed;
    };
    if (options.mode === "disclosures") {
        const completed = [];
        for (const host of options.hosts) {
            const context = await browser.newContext({ javaScriptEnabled: !options.noScript });
            const current = await context.newPage();
            const errors = [],
                consoleErrors = [],
                failedRequests = [];
            current.on("pageerror", (error) => errors.push(error.message));
            current.on("console", (message) => {
                if (message.type() === "error") consoleErrors.push(message.text());
            });
            current.on("requestfailed", (request) =>
                failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
            );
            try {
                completed.push(...(await nativeDisclosures(current, host, options.noScript)));
                assert(errors.length === 0 && consoleErrors.length === 0, `${host.name}: disclosure runtime errors`);
                results.push(
                    options.noScript
                        ? "static noscript: native disclosures and keyboard toggling"
                        : `${host.name}: native disclosures, folding and navigation`,
                );
            } catch (error) {
                await failure(current, `${host.name}-disclosures`, error, { errors, consoleErrors, failedRequests });
            } finally {
                await context.close();
            }
        }
        return { status: "FORMA_MARKDOWN_BROWSER_PASSED", results, sourceCases: { disclosures: completed } };
    }
    const readingSyntax = async (current, host, noScript = false) => {
        assert(options.readingCases?.length > 0, `${host.name}: P1 source cases missing`);
        const completed = [];
        for (const fixture of options.readingCases) {
            await current.goto(`${host.origin}${host.root}/notes/p1-${fixture.id}/`);
            if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
            const reader = current.locator('[data-reader="markdown"]:not([data-reader-loading]):not([role="alert"])');
            await reader.waitFor({ state: "attached" });
            const math = noScript ? 0 : fixture.inlineMath + fixture.displayMath;
            if (math) await reader.locator(".katex").first().waitFor({ state: "attached" });
            const label = `${host.name}${noScript ? " noscript" : ""} P1 ${fixture.id}`;
            // Sticky headers copy authored table headings into an aria-hidden rail.
            const count = (selector) =>
                reader
                    .locator(selector)
                    .evaluateAll(
                        (nodes) => nodes.filter((node) => !node.closest("[data-markdown-sticky-header]")).length,
                    );
            for (const header of await reader.locator("[data-markdown-sticky-header]").all()) {
                assert((await header.getAttribute("aria-hidden")) === "true", `${label}: exposed header copy`);
            }
            for (const [tag, expected] of Object.entries({ mark: 0, sub: 0, sup: 0, del: 0, ...fixture.tags })) {
                assert((await count(tag)) === expected, `${label}: ${tag}`);
            }
            assert((await count(".katex")) === math, `${label}: formula count`);
            assert((await count(".katex-display")) === (noScript ? 0 : fixture.displayMath), `${label}: display count`);
            const text = await reader.textContent();
            for (const literal of [...fixture.contains, ...(noScript ? fixture.fallbackText : [])])
                assert(text.includes(literal), `${label}: missing ${literal}`);
            assert(
                (await reader.locator("script,iframe,[onclick],[onerror]").count()) === 0,
                `${label}: unsafe output`,
            );
            completed.push(fixture.id);
        }
        await current.goto(`${host.origin}${host.root}/notes/reading-p1/`);
        if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
        const reader = current.locator('[data-reader="markdown"]:not([data-reader-loading])');
        await reader.locator("mark").first().waitFor({ state: "attached" });
        for (const width of [1280, 390])
            for (const scheme of ["light", "dark"]) {
                await current.setViewportSize({ width, height: 900 });
                await current.emulateMedia({ colorScheme: scheme });
                await current.evaluate(
                    (scheme) => document.documentElement.setAttribute("data-theme", `choral-${scheme}`),
                    scheme,
                );
                const audit = await reader.evaluate((reader) => {
                    const mark = reader.querySelector("mark");
                    const style = getComputedStyle(mark);
                    const canvas = document.createElement("canvas");
                    canvas.width = canvas.height = 1;
                    const ctx = canvas.getContext("2d", { willReadFrequently: true });
                    const luminance = (color) => {
                        ctx.clearRect(0, 0, 1, 1);
                        ctx.fillStyle = color;
                        ctx.fillRect(0, 0, 1, 1);
                        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                        const linear = (v) => {
                            v /= 255;
                            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
                        };
                        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
                    };
                    const a = luminance(style.color),
                        b = luminance(style.backgroundColor);
                    return {
                        scheme: getComputedStyle(document.documentElement).colorScheme,
                        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
                        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                    };
                });
                assert(audit.scheme === scheme, `${host.name}: expected ${scheme} theme, got ${audit.scheme}`);
                assert(audit.contrast >= 4.5, `${host.name}: highlight contrast ${audit.contrast}`);
                assert(!audit.overflow, `${host.name}: P1 page overflow at ${width}`);
                await current.screenshot({
                    path: `${options.artifacts}/${host.name}-p1-${width}-${scheme}${noScript ? "-noscript" : ""}.png`,
                    fullPage: true,
                });
            }
        await current.setViewportSize({ width: 1280, height: 900 });
        await current.emulateMedia({ colorScheme: "light" });
        return completed;
    };
    // daisyUI menus wrap as flex columns that grow to their widest row, and a hidden overflow
    // is still scrollable; either lets a long title shift or clip the sidebar tree.
    const sidebarTreeFit = async (current, host) => {
        await current.setViewportSize({ width: 1280, height: 900 });
        await current.goto(`${host.origin}${host.root}/notes/sidebar/nested/long-title/`);
        await current.locator("[data-enhancement-ready]").waitFor();
        const tree = current.locator('.drawer-side nav[aria-label="Files"]');
        await tree.locator('[aria-current="page"]').waitFor();
        const fit = await tree.evaluate((nav) => {
            const right = nav.getBoundingClientRect().right;
            const label = nav.querySelector('[aria-current="page"] .truncate');
            return {
                scroll: [nav.scrollWidth, nav.clientWidth, nav.scrollLeft],
                overflowingRows: [...nav.querySelectorAll("li")].filter(
                    (row) => row.getBoundingClientRect().right > right + 1,
                ).length,
                truncated: label ? label.scrollWidth > label.clientWidth : undefined,
            };
        });
        assert(
            fit.scroll[0] <= fit.scroll[1] + 1 && fit.scroll[2] === 0 && fit.overflowingRows === 0 && fit.truncated,
            `${host.name}: sidebar tree does not fit ${JSON.stringify(fit)}`,
        );
    };
    // A directory URL opened directly is a real page: the static export writes it, and the
    // enhanced app shows the same listing with the directory's name as its title.
    const directoryPage = async (current, host, noScript = false) => {
        const response = await current.goto(`${host.origin}${host.root}/notes/sidebar/`);
        assert(response?.status() === 200, `${host.name}: directory page status ${response?.status()}`);
        if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
        const heading = noScript ? current.locator("main h1") : current.locator("main h1").first();
        assert((await heading.textContent())?.trim() === "sidebar", `${host.name}: directory page heading`);
        assert(
            (await current.locator('main a[href$="/notes/sidebar/nested"]').count()) > 0,
            `${host.name}: directory page folder link`,
        );
        if (host.name === "static" && !noScript) {
            assert(
                (await current.title()).startsWith("sidebar · "),
                `static: directory title ${await current.title()}`,
            );
        }
    };
    const mountedDocument = async (current, host) => {
        const path = `${host.root}/preview/same`;
        await current.goto(`${host.origin}${path}/`);
        const enhanced = current.locator("[data-enhancement-ready]");
        await enhanced.locator("main").getByRole("heading", { level: 1, name: "Mounted document" }).waitFor();
        await current.waitForFunction(() => document.title.startsWith("Mounted document · "));
        assert(
            (await current.locator('link[rel="canonical"]').getAttribute("href")) === `${host.origin}${path}`,
            "static: mounted document canonical URL",
        );
        assert(
            (await enhanced.locator('aside a[aria-current="page"]').first().getAttribute("href")) === path,
            "static: mounted document sidebar selection",
        );
        const jump = enhanced.locator("main").getByRole("link", { name: "Jump to details" });
        assert((await jump.getAttribute("href")) === `${path}#details`, "static: mounted document fragment URL");
        await jump.click();
        await current.waitForURL((url) => url.pathname.replace(/\/$/u, "") === path && url.hash === "#details");
    };
    const staticSystemRoutes = async (current, host, noScript = false) => {
        const health = await current.goto(`${host.origin}${host.root}/-/health/`);
        assert(health?.status() === 200, "static: direct Health response");
        const page = noScript ? current.locator("main") : current.locator("[data-enhancement-ready] main");
        await page.getByRole("heading", { level: 1, name: "Health", exact: true }).waitFor();
        if (!noScript) {
            const healthLink = current.locator('aside nav[aria-label="Workspace status"] a[aria-current="page"]');
            assert(
                (await healthLink.getAttribute("href")) === `${host.root}/-/health`,
                "static: direct Health selection",
            );
        }
        await current.goto(`${host.origin}${host.root}/-/`, { waitUntil: "commit" });
        await current.waitForURL(`${host.origin}${host.root}/`);
    };
    const canonicalTerm = async (current, host) => {
        for (const [encoded, title] of [
            ["wow%21", "Punctuation term"],
            ["literal%252F", "Literal slash term"],
        ]) {
            const path = `${host.root}/-/browse/spaces/${encoded}`;
            const canonical = `${host.origin}${path}`;
            const sitemap = await current.request.get(`${host.origin}${host.root}/sitemap.xml`);
            assert(
                sitemap.ok() && (await sitemap.text()).includes(`<loc>${canonical}</loc>`),
                "static: canonical term URL",
            );
            const response = await current.goto(canonical);
            assert(response?.ok(), "static: direct canonical term response");
            const enhanced = current.locator("[data-enhancement-ready]");
            await enhanced.locator("main").getByRole("heading", { level: 1, name: title, exact: true }).waitFor();
            const selected = enhanced.locator('aside a[aria-current="page"]', { hasText: title });
            assert((await selected.getAttribute("href")) === path, "static: encoded term sidebar selection");
            assert(
                (await current.locator('link[rel="canonical"]').getAttribute("href")) === canonical,
                "static: canonical term URL after enhancement",
            );
        }
    };
    const canonicalView = async (current, host) => {
        for (const [encoded, title] of [
            ["wow%21", "Punctuation View"],
            ["hash%23", "Hash View"],
            ["query%3F", "Query View"],
            ["literal%252F", "Literal slash View"],
            ["literal%2525", "Literal percent View"],
        ]) {
            const path = `${host.root}/-/views/${encoded}`;
            const canonical = `${host.origin}${path}`;
            const sitemap = await current.request.get(`${host.origin}${host.root}/sitemap.xml`);
            assert(
                sitemap.ok() && (await sitemap.text()).includes(`<loc>${canonical}</loc>`),
                "static: canonical View URL",
            );
            const urls = encoded === "wow%21" ? [canonical, `${host.origin}${host.root}/-/views/wow!`] : [canonical];
            for (const url of urls) {
                const response = await current.goto(url);
                assert(response?.ok(), "static: direct View response");
                const enhanced = current.locator("[data-enhancement-ready]");
                await enhanced.locator("main").getByRole("heading", { level: 1, name: title, exact: true }).waitFor();
                assert(
                    (await current.locator("[data-static-fallback]").count()) === 0,
                    "static: View fallback remains",
                );
                const selected = enhanced.locator('aside a[aria-current="page"]', { hasText: title });
                assert((await selected.getAttribute("href")) === path, "static: View sidebar selection");
                assert(
                    (await current.locator('link[rel="canonical"]').getAttribute("href")) === canonical,
                    "static: View canonical metadata",
                );
                await enhanced
                    .locator("main table")
                    .getByRole("link", { name: "Open source entry Selected node", exact: true })
                    .click();
                await current.waitForURL(
                    (destination) => destination.pathname.replace(/\/$/u, "") === `${host.root}/graph/selected`,
                );
                await current
                    .locator("[data-enhancement-ready] main")
                    .getByRole("heading", { level: 1, name: "Selected node", exact: true })
                    .waitFor();
                // A different View cannot reuse the startup projection prepared for this URL.
                const nextTitle = title === "Hash View" ? "Query View" : "Hash View";
                await current
                    .locator("[data-enhancement-ready] aside")
                    .getByRole("link", { name: nextTitle, exact: true })
                    .click();
                await current
                    .locator("[data-enhancement-ready] main")
                    .getByRole("heading", { level: 1, name: nextTitle, exact: true })
                    .waitFor();
                await current
                    .locator("[data-enhancement-ready] main table")
                    .getByRole("link", { name: "Open source entry Selected node", exact: true })
                    .waitFor();
            }
        }
    };
    const routeLinks = async (current, host, noScript = false) => {
        const main = current.locator(host.name === "static" && !noScript ? "[data-enhancement-ready] main" : "main");
        for (const [label, path, title] of [
            ["Encoded space", "/notes/route%20space", "Encoded space target"],
            ["Literal escape", "/notes/literal%2520", "Literal escape target"],
            ["Punctuation", "/notes/hash%20%23%E4%B8%AD%E6%96%87%21", "Punctuation target"],
            ["Double extension", "/notes/target.md", "Double extension"],
        ]) {
            await current.goto(`${host.origin}${host.root}/notes/route-links/`);
            const link = main.getByRole("link", { name: label, exact: true });
            await link.waitFor();
            assert(
                (await link.getAttribute("href")) === `${host.root}${path}`,
                `${host.name}: resolved source link URL`,
            );
            await link.click();
            await current.waitForURL((url) => url.pathname.replace(/\/$/u, "") === `${host.root}${path}`);
            await main.getByRole("heading", { level: 1, name: title, exact: true }).waitFor();
        }
    };
    const markdownLinkContracts = async (current, host, noScript = false) => {
        const viewPath = host.name === "static" ? "/-/views/link-contracts/" : "/-/views/link-contracts";
        for (const [sourcePath, label] of [
            ["/notes/link-contracts/", "Encoded entry"],
            [viewPath, "Root source"],
            [viewPath, "Encoded source"],
        ]) {
            await current.goto(`${host.origin}${host.root}${sourcePath}`);
            const main = current.locator(
                host.name === "static" && !noScript ? "[data-enhancement-ready] main" : "main",
            );
            const link = main.getByRole("link", { name: label, exact: true });
            await link.waitFor();
            const destination = new URL(await link.getAttribute("href"), current.url());
            assert(destination.pathname === `${host.root}/notes/contract-target`, `${host.name}: source link target`);
            assert(decodeURIComponent(destination.hash) === "#hello-world", `${host.name}: encoded source fragment`);
            await link.click();
            await current.waitForURL(
                (url) => url.pathname.replace(/\/$/u, "") === `${host.root}/notes/contract-target`,
            );
            await main.getByRole("heading", { level: 1, name: "Contract target", exact: true }).waitFor();
            await main.getByRole("heading", { level: 2, name: "Hello world", exact: true }).waitFor();
            assert((await current.locator('[id="hello-world"]').count()) === 1, `${host.name}: fragment target exists`);
        }
    };
    const classificationLayout = async (current, host) => {
        const viewport = current.viewportSize();
        const selector = host.name === "static" ? "[data-enhancement-ready] main" : "main";
        try {
            const label = "Deployment and workspace configuration documentation";
            const longLabel = "Deployment ConfigurationManagementDocumentationProductionRelease";
            for (const [route, title, punctuation = "·"] of [
                ["classification-layout", "Deployment and workspace configuration documentation-"],
                ["classification-space-layout", label],
                ["classification-ideographic-layout", label],
                ["classification-line-layout", label],
                ["classification-paragraph-layout", label],
                ["classification-long-layout", "ProductionConfigurationDeploymentManagementDocumentation"],
                ["classification-comma-layout", label, ","],
                ["classification-long-mark-layout", longLabel],
                ["classification-long-comma-layout", longLabel, ","],
                ["classification-mixed-space-layout", `${label}\u00a0`],
                ["classification-mixed-space-layout", `${label}\u200f`, ","],
                ["classification-mixed-bidi-layout", `${label}\u200f`],
                ["classification-cjk-bidi-layout", "日常プロジェクト運営資料と構成変更の詳細\u200f"],
                ["classification-figure-layout", "Lifecycle Owner" + "\u2007".repeat(52)],
            ]) {
                await current.setViewportSize({ width: 320, height: 720 });
                await current.goto(`${host.origin}${host.root}/${route}/`);
                const groups = current.locator(selector).getByRole("list", { name: "Classifications" });
                const term = groups.getByRole("link", { name: title.trim(), exact: true });
                await term.waitFor();
                for (const width of [320, 390, 402, 408, 412, 424, 426, 430]) {
                    await current.setViewportSize({ width, height: 720 });
                    const { displayedTitle, wrapped, sameLine, fitsReader } = await term.evaluate(
                        (link, punctuation) => {
                            const marker = link.querySelector('span[aria-hidden="true"]');
                            const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
                            const lines = new Set();
                            let displayedTitle = "";
                            let lastGlyph;
                            while (walker.nextNode()) {
                                const text = walker.currentNode;
                                if (marker?.contains(text)) continue;
                                displayedTitle += text.textContent;
                                const textRange = document.createRange();
                                textRange.selectNodeContents(text);
                                for (const rect of textRange.getClientRects()) {
                                    if (rect.width > 0) lines.add(Math.round(rect.top));
                                }
                                const finalCharacter = Array.from(
                                    text.textContent.matchAll(/[^\p{White_Space}\p{Cf}]/gu),
                                ).at(-1);
                                if (finalCharacter) {
                                    textRange.setStart(text, finalCharacter.index);
                                    textRange.setEnd(text, finalCharacter.index + finalCharacter[0].length);
                                    lastGlyph = textRange.getBoundingClientRect();
                                }
                            }
                            const markRange = document.createRange();
                            if (marker?.textContent?.endsWith(punctuation)) markRange.selectNodeContents(marker);
                            const mark = markRange.getBoundingClientRect();
                            const reader = link.closest("main");
                            return {
                                displayedTitle,
                                wrapped: lines.size > 1,
                                sameLine: lastGlyph && lastGlyph.top < mark.bottom && mark.top < lastGlyph.bottom - 2,
                                fitsReader: reader && reader.scrollWidth <= reader.clientWidth + 1,
                            };
                        },
                        punctuation,
                    );
                    assert(displayedTitle === title, `${host.name}: ${route} retains the display name`);
                    if (
                        width === 320 &&
                        !["classification-cjk-bidi-layout", "classification-figure-layout"].includes(route)
                    ) {
                        assert(wrapped, `${host.name}: ${route} title wraps at narrow width`);
                    }
                    assert(sameLine, `${host.name}: ${route} punctuation stays with the term at ${width}px`);
                    assert(fitsReader, `${host.name}: ${route} fits the reader at ${width}px`);
                }
                if (route === "classification-long-layout") {
                    await current.setViewportSize({ width: 320, height: 720 });
                    await term.focus();
                    await term.press("Enter");
                    await current.waitForURL(
                        (url) =>
                            url.pathname.replace(/\/$/u, "") ===
                            `${host.root}/-/browse/spaces/classification-long-layout`,
                    );
                }
            }
        } finally {
            if (viewport) await current.setViewportSize(viewport);
        }
    };

    const publishedHeadingTargets = async (current, host, noScript) => {
        const base = `${host.origin}${host.root}`;
        const main = current.locator(host.name === "static" && !noScript ? "[data-enhancement-ready] main" : "main");
        const cases = [
            ["/notes/published-heading-links/", "Uppercase omitted title", "#forma-heading-hello-world"],
            ["/notes/published-heading-links/", "Underscore omitted title", "#forma-heading-hello-world"],
            ["/notes/published-heading-links/", "Named double collision", "#forma-omitted-title"],
            ["/notes/published-heading-links/", "Body alias after collision", "h2#foo"],
            ["/notes/shell-heading-links/", "Root title link", "h2#root"],
            ["/notes/shell-heading-links/", "Entry top title link", "h2#entry-top"],
            ["/notes/shell-heading-links/", "Config title link", "h2#forma-static-workspace"],
            ["/notes/shell-heading-links/", "Main title link", "h2#main-content"],
            ["/notes/shell-heading-links/", "Navigation title link", "h2#workspace-navigation"],
            ["/notes/shell-heading-links/", "Sidebar title link", "h2#workspace-sidebar"],
            ["/notes/shell-heading-links/", "Related title link", "h2#related-documents"],
            ["/notes/shell-heading-links/", "Theme heading", "h2#workspace-theme-menu"],
            ["/notes/shell-heading-links/", "Quick open heading", "h2#workspace-quick-open"],
            ["/notes/shell-heading-links/", "Reader label heading", "h2#reader-heading-label-1"],
            ["/-/views/view-heading-intro/", "Setup", "h2#setup"],
            ["/-/views/view-heading-intro/", "Deploy", "h2#deploy"],
        ];
        for (const [source, label, selector] of cases) {
            await current.goto(`${base}${source}`);
            const link = main.locator("a[href]").filter({ hasText: new RegExp(`^${label}$`, "u") });
            await link.click();
            await current.waitForFunction(
                ({ target, native }) => {
                    const element = native ? document.querySelector(":target") : document.activeElement;
                    return Boolean(element?.closest(target));
                },
                { target: selector, native: noScript },
            );
            if (source === "/notes/shell-heading-links/") {
                const id = selector.slice("h2#".length);
                assert((await current.locator(`[id="${id}"]`).count()) === 1, `${host.name}: ${label} has a unique ID`);
                assert(
                    (await current.locator("header#entry-top-").count()) === 1,
                    `${host.name}: entry header keeps a separate ID`,
                );
            }
        }
        if (!noScript) {
            await current.goto(base + "/notes/shell-heading-links/");
            const footerLink = main.getByRole("navigation", { name: "Page outline footer" }).getByRole("link", {
                name: /Related documents/u,
            });
            await footerLink.click();
            await current.waitForFunction(() => document.activeElement?.matches("section#related-documents-"));
            const skipLink = current.getByRole("link", { name: "Skip to content", exact: true });
            await skipLink.focus();
            await skipLink.press("Enter");
            await current.waitForFunction(() => document.activeElement?.matches("main h1"));
            await current.getByRole("button", { name: "Quick open", exact: true }).first().click();
            await current.locator('dialog[id="forma:workspace-quick-open"][open]').waitFor();
            await current.keyboard.press("Escape");
            await current.locator('dialog[id="forma:workspace-quick-open"][open]').waitFor({ state: "hidden" });
            await current
                .getByRole("button", { name: /^Theme:/u })
                .first()
                .click();
            await current.locator('[id="forma:workspace-theme-menu"]:popover-open').waitFor();
            await current.keyboard.press("Escape");
        }
    };

    const crossSurfaceLinks = async (current, host, noScript = false) => {
        const base = `${host.origin}${host.root}`;
        const source = `${base}/notes/link-contracts/`;
        const isStatic = host.name === "static";
        const main = current.locator(isStatic && !noScript ? "[data-enhancement-ready] main" : "main");

        await current.goto(source);
        const wiki = main.locator("a[href]").filter({ hasText: /^Wiki jump$/u });
        await wiki.click();
        await current.waitForURL(
            (url) =>
                url.pathname.replace(/\/$/u, "") === `${host.root}/notes/link-contracts` &&
                url.hash === (isStatic ? "#local-heading" : "#Local%20heading"),
        );
        if (!noScript) {
            await current.waitForFunction(() => document.activeElement?.id === "local-heading");
        }

        const image = main.getByRole("img", { name: "Encoded image", exact: true });
        await image.waitFor();
        const imageUrl = new URL(await image.getAttribute("src"), current.url());
        assert(
            imageUrl.pathname === `${host.root}/-/raw/notes/contract%20%23%25.svg`,
            `${host.name}: encoded raw image path`,
        );
        assert(imageUrl.searchParams.get("value") === "a&b", `${host.name}: encoded image query`);
        assert((await current.request.get(imageUrl.href)).ok(), `${host.name}: encoded raw image response`);
        await main.getByRole("link", { name: "Reference destination", exact: true }).click();
        await main.getByRole("heading", { level: 1, name: "Contract target", exact: true }).waitFor();
        assert(
            new URL(current.url()).pathname.replace(/\/$/u, "") === `${host.root}/notes/contract-target`,
            "reference link opens canonical target",
        );

        await current.goto(source);
        const missing = main.getByRole("link", { name: "Missing named section", exact: true });
        await missing.waitFor();
        const missingUrl = new URL(await missing.getAttribute("href"), current.url());
        assert(decodeURIComponent(missingUrl.hash) === "#不存在", `${host.name}: unknown heading keeps its fragment`);
        await main.getByRole("link", { name: "Second named section", exact: true }).click();
        await current.waitForURL((url) => url.pathname.replace(/\/$/u, "") === `${host.root}/notes/contract-target`);
        const named = main.getByRole("heading", { level: 2, name: "第二节", exact: true });
        await named.waitFor();
        assert((await named.getAttribute("id")) === "section-2", `${host.name}: second non-ASCII heading owns its id`);
        if (noScript) {
            assert(new URL(current.url()).hash === "#section-2", "static: resolved non-ASCII heading link");
        } else {
            await current.waitForFunction(() => document.activeElement?.id === "section-2");
        }

        const titleAlias = "forma-heading-总览";
        const fragmentCases = [
            { label: "Missing mixed heading", fragment: "缺失版本 v2", heading: "第二节", wrongId: "v2" },
            { label: "Encoded blank fragment", fragment: " ", heading: "第二节", wrongId: "section" },
            {
                label: "Reserved prefix heading",
                fragment: isStatic ? "forma-heading" : "forma-heading-前缀",
                heading: "forma-heading-前缀",
                targetId: "forma-heading",
            },
            {
                label: "Hyphenated heading with punctuation",
                fragment: isStatic ? "host-visual-2026-09-24" : "Host-Visual-—-2026-09-24",
                heading: "Host Visual — 2026-09-24",
                targetId: "host-visual-2026-09-24",
            },
            {
                label: "Omitted named title",
                fragment: isStatic ? titleAlias : "总览",
                heading: "正文",
                targetId: titleAlias,
            },
            { label: "Explicit title alias", fragment: titleAlias, heading: "正文", targetId: titleAlias },
            {
                label: "Omitted title with alias collision",
                fragment: isStatic ? "alias-owner" : "Alias owner",
                heading: "Forma heading alias owner",
                targetId: isStatic ? "alias-owner" : "forma-omitted-title",
            },
        ];
        for (const { label, fragment, heading, targetId, wrongId } of fragmentCases) {
            await current.goto(source);
            const link = main.getByRole("link", { name: label, exact: true });
            const href = new URL(await link.getAttribute("href"), current.url());
            assert(
                decodeURIComponent(href.hash) === `#${fragment}`,
                `${host.name}: ${label} retains the correct fragment`,
            );
            await link.click();
            await main.getByRole("heading", { level: 2, name: heading, exact: true }).waitFor();
            assert(
                decodeURIComponent(new URL(current.url()).hash) === `#${fragment}`,
                `${host.name}: ${label} after click`,
            );
            if (targetId) {
                await current.waitForFunction(
                    ({ id, native }) =>
                        (native ? document.querySelector(":target") : document.activeElement)?.id === id,
                    { id: targetId, native: noScript },
                );
            } else {
                const hasWrongTarget = await current.evaluate(
                    (id) => document.activeElement?.id === id || document.querySelector(":target")?.id === id,
                    wrongId,
                );
                assert(!hasWrongTarget, `${host.name}: ${label} does not jump to ${wrongId}`);
            }
        }

        const view = isStatic ? "/-/views/link-contracts/" : "/-/views/link-contracts";
        await current.goto(`${base}${view}`);
        const repeat = main.getByRole("heading", { level: 2, name: "Repeat", exact: true });
        await repeat.nth(1).waitFor();
        assert(
            (await repeat.nth(1).getAttribute("id")) === "repeat-2",
            `${host.name}: second View heading owns the target`,
        );
        for (const id of ["repeat", "repeat-2", "forma-heading-repeat", "forma-heading-repeat-2"]) {
            assert((await main.locator(`[id="${id}"]`).count()) === 1, `${host.name}: unique View anchor ${id}`);
        }
        await main
            .locator("a[href]")
            .filter({ hasText: /^Second heading$/u })
            .click();
        await current.waitForURL(
            (url) =>
                url.pathname.replace(/\/$/u, "") === `${host.root}${view.replace(/\/$/u, "")}` &&
                url.hash === "#repeat-2",
        );
        await main.getByRole("link", { name: "Across projection", exact: true }).click();
        await main.getByRole("heading", { level: 1, name: "Contract target", exact: true }).waitFor();
        if (isStatic) {
            await current.goto(`${base}${view}`);
            await main.getByRole("link", { name: "Localized source", exact: true }).click();
            await main.getByRole("heading", { level: 1, name: "Localized target", exact: true }).waitFor();
            assert(
                new URL(current.url()).pathname.replace(/\/$/u, "") === `${host.root}/notes/contract-target.zh-hans`,
                "static: View link opens localized variant",
            );
        }
    };
    const headingNavigation = async (current, host, noScript = false) => {
        const base = `${host.origin}${host.root}`;
        const aliases = "/notes/navigation-anchors";
        const source = "/notes/navigation-source";
        const mdx = "/guides/navigation-target";
        const main = current.locator(host.name === "static" && !noScript ? "[data-enhancement-ready] main" : "main");
        const cases = [
            [aliases, "Local wiki alias", aliases, "前缀", 2],
            [aliases, "Local explicit alias", aliases, "前缀", 2],
            [source, "Cross-entry wiki alias", aliases, "前缀", 2],
            [aliases, "Local repeated title", aliases, "Duplicate", 4],
            [aliases, "Path-qualified repeated title", aliases, "Duplicate", 4],
            [source, "Cross-entry repeated title", aliases, "Duplicate", 4],
            [source, "Explicit MDX wiki", mdx, "第二节", 2],
            [source, "Extensionless MDX wiki", mdx, "第二节", 2],
            [source, "Ordinary MDX link", mdx, "第二节", 2],
            ["", "Home MDX wiki", mdx, "第二节", 2],
            ["/-/views/view-navigation-split", "View MDX wiki", mdx, "第二节", 2],
            ["", "Home deep MDX", "/guides/nested/deeper/deep-basename", "Deep section", 2],
            ["", "Home dotted MDX", "/guides/nested/deeper/dotted.v2", "Dotted section", 2],
            [
                "/-/views/view-navigation-split",
                "View deep MDX",
                "/guides/nested/deeper/deep-basename",
                "Deep section",
                2,
            ],
            [
                "/-/views/view-navigation-split",
                "View dotted MDX",
                "/guides/nested/deeper/dotted.v2",
                "Dotted section",
                2,
            ],
            ["/-/views/view-navigation-split", "Guide ] beta", mdx, "第二节", 2],
        ];
        for (const [from, label, target, title, level] of cases) {
            await current.goto(`${base}${from}/`);
            await main
                .locator("a[href]")
                .filter({ hasText: new RegExp(`^${RegExp.escape(label)}$`, "u") })
                .click();
            await current.waitForURL(
                (url) => url.pathname.replace(/\/$/u, "") === `${host.root}${target}` && url.hash !== "",
            );
            await main.getByRole("heading", { name: title, level, exact: true }).waitFor();
            await current.waitForFunction(
                ({ title, level, native }) => {
                    const target = native ? document.querySelector(":target") : document.activeElement;
                    const heading = target?.closest("h1,h2,h3,h4,h5,h6");
                    return (
                        heading?.tagName === `H${level}` &&
                        (heading.dataset.readerHeadingText ?? heading.textContent) === title
                    );
                },
                { title, level, native: noScript },
            );
        }
    };
    const viewAndFootnoteNavigation = async (current, host, noScript) => {
        const base = host.origin + host.root;
        const main = current.locator(host.name === "static" && !noScript ? "[data-enhancement-ready] main" : "main");
        const waitForTarget = (selector) =>
            current.waitForFunction(
                ({ selector, native }) =>
                    Boolean((native ? document.querySelector(":target") : document.activeElement)?.closest(selector)),
                { selector, native: noScript },
            );
        for (const [route, fragment, target, ready] of [
            ["/-/views/view-navigation-split/", "forma-omitted-title", "#forma-omitted-title", "Foo"],
            ["/-/views/view-navigation-split/", "forma-heading-foo", "h2#foo", "Foo"],
            ["/-/views/view-navigation-comment/", "section", "h1#section", "中文副标题"],
            ["/-/views/view-navigation-split/", "footnote-detail", "h2#footnote-detail", "Footnote detail"],
        ]) {
            await current.goto(base + route + "#" + fragment);
            await main.getByRole("heading", { name: ready, exact: true }).waitFor();
            const ids = current.locator('[id="' + fragment + '"]');
            assert((await ids.count()) === 1, host.name + ": unique View fragment " + fragment);
            await waitForTarget(target);
        }
        const expectFootnote = async (noteId, refId) => {
            const reference = main.locator('a[id="' + refId + '"]');
            const note = main.locator('li[id="' + noteId + '"]');
            await reference.click();
            await current.waitForURL((url) => url.hash === "#" + noteId);
            await waitForTarget('li[id="' + noteId + '"]');
            await note.locator("[data-footnote-backref]").click();
            await current.waitForURL((url) => url.hash === "#" + refId);
            await waitForTarget('a[id="' + refId + '"]');
        };
        await expectFootnote("user-content-fn-body", "user-content-fnref-body");
        await current.goto(base + "/notes/footnote-heading-links/");
        await main
            .locator("a[href]")
            .filter({ hasText: /^Authored heading$/u })
            .click();
        await waitForTarget("h2#user-content-fn-note");
        for (const id of ["user-content-fn-note", "user-content-fnref-note"]) {
            assert((await main.locator('[id="' + id + '"]').count()) === 1, host.name + ": unique authored ID " + id);
        }
        await expectFootnote("user-content-fn-note-", "user-content-fnref-note-");
        const auditedView = base + "/-/views/view-audited-headings/";
        for (const [id, title, level] of [
            ["title", "Title 🌟", 1],
            ["after", "After 💡", 2],
        ]) {
            await current.goto(auditedView + "#" + id);
            await main.getByRole("heading", { name: title, level, exact: true }).waitFor();
            assert((await main.locator('[id="' + id + '"]').count()) === 1, host.name + ": preserves " + id);
            await waitForTarget("h" + level + "#" + id);
        }
        const projectionLink = main.locator('a[href="' + host.root + '/graph/selected"]').first();
        await projectionLink.waitFor();
        assert(
            await projectionLink.evaluate((link) =>
                Boolean(
                    link.compareDocumentPosition(document.getElementById("after")) & Node.DOCUMENT_POSITION_FOLLOWING,
                ),
            ),
            host.name + ": projection precedes the prose after its mount",
        );
        assert(!(await main.innerText()).includes("<!-- forma:content -->"), host.name + ": mount marker stays hidden");
        for (const [variant, count] of [
            ["nested", 3],
            ["unused", 2],
        ]) {
            await current.goto(base + "/-/views/view-" + variant + "-footnotes/");
            const noteLink = main
                .locator('a[href$="#heading-in-first-note"]')
                .filter({ hasText: /^First note heading$/u });
            await noteLink.click();
            await waitForTarget("h2#heading-in-first-note");
            const expected = main.locator('li[id="user-content-fn-a"] h2#heading-in-first-note');
            assert((await expected.count()) === 1, host.name + ": first note owns its heading in " + variant);
            const returns = await main.locator("[data-footnote-backref]").evaluateAll((links) =>
                links.map((link) => {
                    const id = decodeURIComponent(link.hash.slice(1));
                    return document.getElementById(id)?.tagName === "A";
                }),
            );
            assert(
                returns.length === count && returns.every(Boolean),
                host.name + ": every " + variant + " return has a reference",
            );
        }
    };
    const queryAndFootnoteNavigation = async (current, host, noScript) => {
        const pathname = `${host.root}/notes/query-fragment-navigation`;
        const pageUrl = `${host.origin}${pathname}/`;
        const initialSearch = "?mode=source&value=a%2Fb&tag=one&tag=two";
        const id = "user-content-fnref-review";
        const hash = `#${id}`;
        const main = current.locator(noScript ? "main" : "[data-enhancement-ready] main");
        await current.goto("about:blank");
        await current.goto(pageUrl + initialSearch);
        await main.locator("details[data-callout-fold]:not([open])").waitFor({ state: "attached" });
        const initialPathname = new URL(current.url()).pathname;
        const changedSearch = "?mode=next&value=a%3Fb&tag=one&tag=two";
        const expectLanding = async (label, search) => {
            await current.waitForURL(
                (url) =>
                    (noScript ? url.pathname.replace(/\/$/u, "") === pathname : url.pathname === initialPathname) &&
                    url.search === search &&
                    url.hash === hash,
            );
            if (noScript) {
                await current.locator(`a[id="${id}"]:target`).waitFor({ state: "attached" });
            } else {
                await expectFootnoteLanding(current, `${host.name}: ${label}`, { id, search, foldCount: 1 });
            }
        };
        for (const [label, search] of [
            ["Keep query and jump", initialSearch],
            ["Change query and jump", changedSearch],
        ]) {
            const link = main.locator("a[href]").filter({ hasText: new RegExp(`^${label}$`, "u") });
            const matchesTarget = (url) =>
                url.pathname.replace(/\/$/u, "") === pathname && url.search === search && url.hash === hash;
            const destination = new URL(await link.evaluate((anchor) => anchor.href));
            assert(matchesTarget(destination), `${host.name}: ${label} emits the authored query and fragment`);
            await link.click();
            await expectLanding(label, search);
        }
        await current.goBack();
        await expectLanding("restore the original query on back", initialSearch);
        await current.goForward();
        await expectLanding("restore the changed query on forward", changedSearch);

        const entrySearch = "?value=a%2Fb&tag=one&tag=two";
        for (const [label, route, id] of [
            ["Exact entry query", "/notes/contract-target", "hello-world"],
            ["Alias entry query", "/notes/contract-target", "hello-world"],
            ["Index entry query", "/notes/resource-directory.txt", "details"],
            ["Sidecar entry query", "/guides/query-sidecar.txt", "details"],
            ["Change View query", "/-/views/view-navigation-split", "footnote-detail"],
        ]) {
            const view = label === "Change View query";
            const search = view ? "?mode=detail&tag=one&tag=two" : entrySearch;
            const from = view ? `${host.origin}${host.root}${route}/?mode=source` : pageUrl;
            await current.goto(from);
            const link = main.getByRole("link", { name: label, exact: true });
            const matchesTarget = (url) =>
                url.pathname.replace(/\/$/u, "") === host.root + route &&
                url.search === search &&
                url.hash === `#${id}`;
            assert(matchesTarget(new URL(await link.evaluate((anchor) => anchor.href))), host.name + ": " + label);
            await link.click();
            await current.waitForURL(matchesTarget);
            await current.waitForFunction(
                ({ id, native }) => (native ? document.querySelector(":target") : document.activeElement)?.id === id,
                { id, native: noScript },
            );
        }
    };
    const resourceLinkClicks = async (current, host, noScript) => {
        const base = host.origin + host.root;
        const main = current.locator(host.name === "static" && !noScript ? "[data-enhancement-ready] main" : "main");
        for (const [route, label] of [
            ["/", "Home resource"],
            ["/notes/link-contracts/", "Encoded resource"],
            ["/-/views/view-navigation-split/", "View resource"],
        ]) {
            await current.goto(base + route);
            const link = main.getByRole("link", { name: label, exact: true });
            const href = await link.getAttribute("href");
            const destination = new URL(href, current.url());
            assert(destination.pathname === host.root + "/-/raw/notes/contract-raw.txt", host.name + ": raw route");
            assert(
                JSON.stringify(Object.fromEntries(destination.searchParams)) ===
                    JSON.stringify({ name: "a b", literal: "%20", value: "a&b", plus: "a b" }) &&
                    decodeURIComponent(destination.hash) === "#part one",
                host.name + ": preserves the resource query and fragment from " + route,
            );
            await link.click();
            await current.waitForURL((url) => url.href === destination.href);
            assert(
                (await current.locator("body").innerText()).includes("CONTRACT_RAW_RESOURCE"),
                host.name + ": raw navigation",
            );
        }
    };
    const resourceSuffix = async (current, host, noScript = false) => {
        await current.goto(`${host.origin}${host.root}/notes/link-contracts/`);
        const main = current.locator(noScript ? "main" : "[data-enhancement-ready] main");
        const link = main.getByRole("link", { name: "Encoded resource", exact: true });
        await link.waitFor();
        const destination = new URL(await link.getAttribute("href"), current.url());
        assert(destination.pathname === `${host.root}/-/raw/notes/contract-raw.txt`, "static: resource route");
        assert(destination.searchParams.get("name") === "a b", "static: resource encoded space");
        assert(destination.searchParams.get("literal") === "%20", "static: resource literal escape");
        assert(destination.searchParams.get("value") === "a&b", "static: encoded query separator");
        assert(destination.searchParams.get("plus") === "a b", "static: plus query semantics");
        assert(decodeURIComponent(destination.hash) === "#part one", "static: resource encoded fragment");
        const response = await current.request.get(destination.href);
        assert(
            response.ok() && (await response.text()).includes("CONTRACT_RAW_RESOURCE"),
            "static: resource available",
        );
    };
    const calloutSourceCases = async (current, host, noScript = false) => {
        assert(
            Array.isArray(options.calloutBoundaries) && options.calloutBoundaries.length > 0,
            `${host.name}: exact callout source cases missing`,
        );
        for (const [name, types, quotes] of [
            ["callouts", ["note", "tip", "important", "warning", "caution"], 7],
            ["callout-review", ["note", "tip", "important"], 2],
        ]) {
            await current.goto(`${host.origin}${host.root}/notes/${name}/`);
            if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
            const reader = current.locator('[data-reader="markdown"]');
            await reader.locator("[data-callout]").first().waitFor({ state: "attached" });
            const actualTypes = await reader
                .locator("[data-callout]")
                .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-callout")));
            assert(
                JSON.stringify(actualTypes) === JSON.stringify(types),
                `${host.name}: ${name} callout types: ${JSON.stringify(actualTypes)}`,
            );
            assert((await reader.locator("blockquote").count()) === quotes, `${host.name}: ${name} literal quotes`);
        }
        await current.goto(`${host.origin}${host.root}/notes/callout-boundaries/`);
        if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
        const completed = [];
        for (const fixture of options.calloutBoundaries) {
            const heading = current.getByRole("heading", { name: fixture.id, exact: true });
            const actual = await heading.evaluate((heading) => {
                const fragment = document.createDocumentFragment();
                for (
                    let node = heading.nextElementSibling;
                    node && node.tagName !== "H2";
                    node = node.nextElementSibling
                ) {
                    fragment.append(node.cloneNode(true));
                }
                const wrapper = document.createElement("div");
                wrapper.append(fragment);
                return {
                    types: [...wrapper.querySelectorAll("[data-callout]")].map((node) =>
                        node.getAttribute("data-callout"),
                    ),
                    titles: [...wrapper.querySelectorAll(".forma-callout-title")].map((node) => node.textContent),
                    blockquotes: wrapper.querySelectorAll("blockquote").length,
                    html: wrapper.innerHTML,
                    codes: [...wrapper.querySelectorAll("pre")].map((node) => node.textContent),
                };
            });
            const label = `${host.name}${noScript ? " noscript" : ""}: boundary ${fixture.id}`;
            assert(JSON.stringify(actual.types) === JSON.stringify(fixture.calloutTypes), `${label}: callout types`);
            assert(JSON.stringify(actual.titles) === JSON.stringify(fixture.titles), `${label}: title/body boundary`);
            assert(actual.blockquotes === fixture.blockquotes, `${label}: literal quotes`);
            for (const fragment of fixture.htmlIncludes)
                assert(actual.html.includes(fragment), `${label}: missing ${fragment}`);
            for (const literal of fixture.codeIncludes) {
                assert(
                    actual.codes.some((code) => code.includes(literal)),
                    `${label}: missing literal code`,
                );
            }
            completed.push(fixture.id);
        }
        return completed;
    };
    const callouts = async (current, host, noScript = false) => {
        await current.bringToFront();
        const pageUrl = `${host.origin}${host.root}/notes/callout-interaction/`;
        await current.goto(pageUrl);
        if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
        const disclosures = current.locator("details[data-callout-fold]");
        await disclosures.first().waitFor({ state: "attached" });
        assert((await disclosures.count()) === 3, `${host.name}: foldable callout count`);
        const collapsed = disclosures.first();
        const summary = collapsed.locator("summary");
        const toggle = async () => {
            const box = await summary.boundingBox();
            assert(box, `${host.name}: summary not visible`);
            // Use the reserved disclosure-arrow area, never a nested title link.
            await summary.click({ position: { x: box.width - 12, y: box.height / 2 } });
        };

        const state = async (open) => {
            await collapsed.and(current.locator(open ? "[open]" : ":not([open])")).waitFor({ state: "attached" });
        };
        await state(false);
        assert(await disclosures.nth(1).evaluate((element) => element.open), `${host.name}: expanded default lost`);
        assert(
            !(await disclosures.nth(2).evaluate((element) => element.open)),
            `${host.name}: title-only default lost`,
        );
        assert((await summary.locator("code").innerText()) === "context", `${host.name}: title code lost`);
        assert(
            (await current.locator('[data-reader="markdown"] blockquote').count()) === 3,
            `${host.name}: marker lookalike activated`,
        );
        assert(
            (await current.locator('[data-reader="markdown"] pre code').count()) === 1,
            `${host.name}: code sample lost`,
        );
        await summary.focus();
        await current.keyboard.press("Enter");
        await state(true);
        await current.keyboard.press("Space");
        await state(false);
        await toggle();
        await state(true);
        await toggle();
        await state(false);
        const titleLink = summary.locator('a[href*="#forma-heading-outside-target"]');
        await titleLink.click();
        await current.waitForURL((url) => url.hash === "#forma-heading-outside-target");
        await state(false);
        await summary.locator("sup a").click();
        await state(false);
        if (!noScript) {
            await current.locator('a[href*="#forma-heading-hidden-interaction-heading"]').click();
            await state(true);
            await current.waitForFunction(() => document.activeElement?.tagName === "H2");
            await current.waitForFunction(() => {
                const rect = document.activeElement?.getBoundingClientRect();
                return rect && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight;
            });
            assert(
                await current.evaluate(() => document.activeElement?.tagName === "H2"),
                `${host.name}: hidden heading focus lost: ${JSON.stringify(await current.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id, target: document.getElementById("forma-heading-hidden-interaction-heading")?.getBoundingClientRect().toJSON() })))}`,
            );
            await toggle();
            await state(false);
            const returnId = await collapsed.locator(".collapse-content sup a").getAttribute("id");
            assert(returnId, `${host.name}: body reference ID missing`);
            const landing = { id: returnId, foldCount: 1 };
            await footnoteBackref(current, returnId).click();
            await expectFootnoteLanding(current, `${host.name}: callout footnote return`, landing);
            await current.reload();
            await expectFootnoteLanding(current, `${host.name}: callout footnote refresh`, landing);
            await toggle();
            await state(false);
            await titleLink.click();
            await current.goBack();
            await expectFootnoteLanding(current, `${host.name}: callout footnote history`, landing);
            await current.goto("about:blank");
            await current.goto(`${pageUrl}#${encodeURIComponent(returnId)}`);
            await expectFootnoteLanding(current, `${host.name}: callout footnote direct`, landing);

            const longPage = `${host.origin}${host.root}/notes/folded-footnote-navigation/`;
            const longId = "user-content-fnref-tail";
            const longLanding = { id: longId, foldCount: 1 };
            for (const [width, search] of [
                [1280, ""],
                [390, "?keep=1"],
            ]) {
                await current.setViewportSize({ width, height: 900 });
                await current.goto(`${longPage}${search}`);
                await current.locator("[data-enhancement-ready] details[data-callout-fold]:not([open])").waitFor();
                await footnoteBackref(current, longId).click();
                await expectFootnoteLanding(current, `${host.name}: long callout footnote return at ${width}`, {
                    ...longLanding,
                    search,
                });
            }
            await current.reload();
            await expectFootnoteLanding(current, `${host.name}: long callout footnote refresh`, {
                ...longLanding,
                search: "?keep=1",
            });
            await current.goto("about:blank");
            await current.goto(`${longPage}#${longId}`);
            await expectFootnoteLanding(current, `${host.name}: long callout footnote direct`, longLanding);
            await current
                .locator('[data-reader="markdown"] a[href]')
                .filter({ hasText: /^Before the footnote$/u })
                .focus();
            await current.keyboard.press("Tab");
            await expectFootnoteLanding(current, `${host.name}: footnote retains its Tab stop`, longLanding);
        }
        await current.goto(`${host.origin}${host.root}/notes/callout-layout/`);
        if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
        const layoutSummary = current.locator("details[data-callout-fold] summary").first();
        for (const [width, scheme] of [
            [1280, "light"],
            [1280, "dark"],
            [390, "light"],
            [390, "dark"],
        ]) {
            await current.setViewportSize({ width, height: 900 });
            await current.emulateMedia({ colorScheme: scheme });
            assert(
                await current.evaluate(
                    (scheme) => getComputedStyle(document.documentElement).colorScheme.includes(scheme),
                    scheme,
                ),
                `${host.name}: requested theme not active`,
            );
            await current.keyboard.press("Tab");
            await layoutSummary.focus();
            assert(
                await current.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
                `${host.name}: callout overflow at ${width}`,
            );
            const bounds = await layoutSummary.boundingBox();
            assert(
                bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
                `${host.name}: summary clipped at ${width}`,
            );
            const geometry = await current.locator(".forma-callout").evaluateAll((callouts) =>
                callouts.map((callout) => {
                    const title = callout.querySelector(".forma-callout-title");
                    const details = callout.querySelector("details");
                    const style = getComputedStyle(title);
                    const box = title.getBoundingClientRect();
                    const range = document.createRange();
                    range.selectNodeContents(title);
                    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
                    const body = callout.querySelector(".collapse-content > p");
                    return {
                        overflow: callout.scrollWidth > callout.clientWidth + 1,
                        titleOverflow: title.scrollWidth > title.clientWidth + 1,
                        paddingEnd: parseFloat(style.paddingInlineEnd),
                        arrowSpace: details
                            ? parseFloat(getComputedStyle(title, "::after").insetInlineEnd) +
                              parseFloat(getComputedStyle(title, "::after").width)
                            : 0,
                        titleOnlyExtra:
                            details && !callout.querySelector(".collapse-content").textContent.trim()
                                ? details.getBoundingClientRect().height - box.height
                                : null,
                        textRight: Math.max(...rects.map((rect) => rect.right)),
                        titleRight: box.right,
                        lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
                        focused: title === document.activeElement,
                        focusVisible: title.matches(":focus-visible"),
                        outline: getComputedStyle(details ?? title).outlineStyle,
                        outlineWidth: parseFloat(getComputedStyle(details ?? title).outlineWidth),
                        bodyGap: details?.open && body ? body.getBoundingClientRect().top - box.bottom : null,
                        emptyParagraphs: [...callout.querySelectorAll("p")].filter((p) => !p.textContent.trim()).length,
                    };
                }),
            );
            for (const item of geometry) {
                assert(
                    !item.overflow && !item.titleOverflow,
                    `${host.name}: local callout overflow ${JSON.stringify({ width, scheme, item })}`,
                );
                if (item.arrowSpace > 0)
                    assert(item.paddingEnd >= item.arrowSpace + 4, `${host.name}: insufficient arrow clearance`);
                if (item.titleOnlyExtra !== null)
                    assert(item.titleOnlyExtra <= 1, `${host.name}: title-only disclosure has phantom body space`);
                assert(item.emptyParagraphs === 0, `${host.name}: empty callout paragraph`);
                if (item.paddingEnd > 0)
                    assert(
                        item.textRight <= item.titleRight - item.paddingEnd + 1,
                        `${host.name}: text overlaps arrow`,
                    );
                if (item.bodyGap !== null)
                    assert(item.bodyGap >= 0 && item.bodyGap <= 32, `${host.name}: title/body spacing ${item.bodyGap}`);
            }
            assert(
                geometry[0].focused &&
                    geometry[0].focusVisible &&
                    geometry[0].outline !== "none" &&
                    geometry[0].outlineWidth > 0,
                `${host.name}: keyboard focus indicator missing ${JSON.stringify(geometry[0])}`,
            );
            if (width === 390)
                assert(geometry[0].lines > 1 && geometry[1].lines > 1, `${host.name}: long titles failed to wrap`);
            await current.screenshot({
                path: `${options.artifacts}/${host.name}-callouts-${width}-${scheme}${noScript ? "-noscript" : ""}.png`,
                animations: "disabled",
                fullPage: true,
            });
            // The reader owns scrolling, so a full-page screenshot can omit its lower callouts.
            await current.locator(".forma-callout").last().scrollIntoViewIfNeeded();
            await current.screenshot({
                path: `${options.artifacts}/${host.name}-callouts-${width}-${scheme}${noScript ? "-noscript" : ""}-bottom.png`,
                animations: "disabled",
                fullPage: true,
            });
        }
        await current.setViewportSize({ width: 1280, height: 900 });
        await current.emulateMedia({ colorScheme: "light" });
    };
    const mermaid = async (current, host) => {
        await current.goto(`${host.origin}${host.root}/notes/mermaid/`);
        await current.waitForFunction(
            () => document.querySelectorAll(".mermaid-diagram [data-mermaid-viewer]").length === 6,
        );
        const figures = current.locator(".mermaid-diagram");
        assert(
            JSON.stringify(await figures.evaluateAll((items) => items.map((item) => item.dataset.diagramKind))) ===
                '["flowchart","state","sequence","class","entity relationship","class"]',
            `${host.name}: Mermaid kind coverage changed`,
        );
        assert((await figures.locator("svg.pele").count()) === 6, `${host.name}: Pele output missing`);
        const identifiers = await figures.locator("[id]").evaluateAll((items) => items.map((item) => item.id));
        assert(new Set(identifiers).size === identifiers.length, `${host.name}: duplicate diagram identifiers`);
        const empty = figures.last();
        assert(
            (await empty.locator("svg.pele").getAttribute("viewBox")) === "0 0 0 0",
            `${host.name}: empty class failed`,
        );
        assert(
            (await empty.locator(".sr-only").first().textContent()).includes("0 items"),
            `${host.name}: empty semantics lost`,
        );
        assert(
            (await current.locator('[data-reader="markdown"] > pre code.language-mermaid').textContent()).startsWith(
                "pie",
            ),
            `${host.name}: unsupported diagram source fallback lost`,
        );
        assert(
            (await figures.locator("svg style, svg image, svg a, svg foreignObject, svg [href], svg [src]").count()) ===
                0 && (await figures.locator("svg [style]").count()) === 0,
            `${host.name}: unsafe SVG content survived`,
        );
        const colors = [];
        for (const scheme of ["light", "dark"]) {
            await current.emulateMedia({ colorScheme: scheme });
            await current.evaluate(
                (scheme) => document.documentElement.setAttribute("data-theme", `choral-${scheme}`),
                scheme,
            );
            for (const width of [1440, 1024, 768, 390]) {
                await current.setViewportSize({ width, height: 900 });
                await current.evaluate(
                    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
                );
                const geometry = await figures.evaluateAll((items) =>
                    items.map((item) => {
                        const svg = item.querySelector("svg");
                        const view = svg.viewBox.baseVal;
                        const labels = [...svg.querySelectorAll("text")].map((text) => {
                            const box = text.getBBox();
                            const transform = svg.getScreenCTM().inverse().multiply(text.getScreenCTM());
                            const points = [
                                [box.x, box.y],
                                [box.x + box.width, box.y + box.height],
                            ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(transform));
                            return {
                                x: points[0].x,
                                y: points[0].y,
                                width: points[1].x - points[0].x,
                                height: points[1].y - points[0].y,
                            };
                        });
                        const viewport = item.querySelector(".mermaid-diagram-viewport").getBoundingClientRect();
                        const rail = item.querySelector('[role="group"]').getBoundingClientRect();
                        const bounds = svg.getBoundingClientRect();
                        return {
                            fits: bounds.right <= rail.left + 2 && bounds.left >= viewport.left - 2,
                            labels: labels.every(
                                (box) =>
                                    box.x >= view.x - 2 &&
                                    box.y >= view.y - 2 &&
                                    box.x + box.width <= view.x + view.width + 2 &&
                                    box.y + box.height <= view.y + view.height + 2,
                            ),
                            fg: svg.querySelector("text") ? getComputedStyle(svg.querySelector("text")).fill : "empty",
                        };
                    }),
                );
                assert(
                    geometry.every((item) => item.fits && item.labels),
                    `${host.name}: Mermaid geometry ${width}/${scheme}: ${JSON.stringify(geometry)}`,
                );
                assert(
                    await current.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
                    `${host.name}: horizontal page overflow`,
                );
                if (width === 1440) colors.push(geometry[0].fg);
                await figures.first().scrollIntoViewIfNeeded();
                await current.screenshot({
                    path: `${options.artifacts}/${host.name}-mermaid-${width}-${scheme}.png`,
                    animations: "disabled",
                });
                if (width === 1440) {
                    for (let index = 0; index < 6; index++) {
                        await figures.nth(index).screenshot({
                            path: `${options.artifacts}/${host.name}-mermaid-kind-${index}-${scheme}.png`,
                            animations: "disabled",
                        });
                    }
                }
            }
        }
        assert(
            colors[0] !== colors[1] && colors.every((color) => color !== "rgba(0, 0, 0, 0)"),
            `${host.name}: theme text color not applied: ${colors}`,
        );
        const viewport = figures.first().locator(".mermaid-diagram-viewport");
        const svg = viewport.locator("svg.pele");
        await viewport.focus();
        const before = await svg.getAttribute("style");
        await current.keyboard.press("+");
        assert((await svg.getAttribute("style")) !== before, `${host.name}: keyboard zoom failed`);
        await current.keyboard.press("ArrowRight");
        await current.keyboard.press("0");
        const expand = figures.first().getByRole("button", { name: "Expand Flowchart diagram", exact: true });
        await expand.click();
        await current.locator("dialog[open]").waitFor();
        await current.keyboard.press("Escape");
        await current.locator("dialog[open]").waitFor({ state: "detached" });
        assert(
            await expand.evaluate((item) => item === document.activeElement),
            `${host.name}: Mermaid focus not restored`,
        );
        assert(
            await current.evaluate(() => document.body.style.overflow !== "hidden"),
            `${host.name}: Mermaid scroll lock leaked`,
        );
        await expand.click();
        await current.getByRole("button", { name: "Close Flowchart diagram viewer", exact: true }).click();
        await current.locator("dialog[open]").waitFor({ state: "detached" });
        const expandEmpty = empty.getByRole("button", { name: "Expand Class diagram", exact: true });
        await expandEmpty.click();
        await current.locator("dialog[open] svg.pele-empty").waitFor({ state: "attached" });
        await current.keyboard.press("Escape");
        await current.locator("dialog[open]").waitFor({ state: "detached" });
        assert(
            await expandEmpty.evaluate((item) => item === document.activeElement),
            `${host.name}: empty class focus not restored`,
        );
        await empty.locator("summary").click();
        await empty.locator("pre").waitFor({ state: "visible" });
        assert(
            await empty.locator("details").evaluate((item) => item.open),
            `${host.name}: empty class source unavailable`,
        );
        await current.setViewportSize({ width: 1280, height: 900 });
        await current.emulateMedia({ colorScheme: "light" });
    };
    for (const host of options.mode === "noscript" ? [] : options.hosts) {
        const context = await browser.newContext({
            javaScriptEnabled: !options.noScript,
            viewport: { width: 1280, height: 900 },
        });
        const current = await context.newPage();
        const errors = [];
        const consoleErrors = [];
        const failedRequests = [];
        current.on("console", (message) => {
            if (message.type() === "error") consoleErrors.push(message.text());
        });
        current.on("requestfailed", (request) => {
            const error = request.failure()?.errorText;
            const url = request.url();
            // Chromium blocks the site's module preloads in a JavaScript-disabled context.
            const blockedModule =
                options.noScript &&
                error === "csp" &&
                url.startsWith(`${host.origin}${host.root}/-/assets/`) &&
                url.endsWith(".js");
            if (!error?.includes("ABORTED") && !blockedModule) failedRequests.push({ url, error });
        });
        current.on("pageerror", (error) => errors.push(error.message));
        const assertCleanPage = () => {
            assert(errors.length === 0, `${host.name}: page errors: ${errors.join("; ")}`);
            assert(consoleErrors.length === 0, `${host.name}: console errors: ${consoleErrors.join("; ")}`);
            assert(failedRequests.length === 0, `${host.name}: failed requests: ${JSON.stringify(failedRequests)}`);
        };
        try {
            if (options.mode === "navigation") {
                if (!options.noScript) {
                    await classificationLayout(current, host);
                    results.push(
                        `${host.name}: narrow classifications keep punctuation with the term and fit the reader`,
                    );
                }
                await publishedHeadingTargets(current, host, options.noScript);
                await headingNavigation(current, host, options.noScript);
                assertCleanPage();
                results.push(
                    `${options.noScript ? "static noscript" : host.name}: published anchors and authored heading links reach their targets`,
                );
                await viewAndFootnoteNavigation(current, host, options.noScript);
                await queryAndFootnoteNavigation(current, host, options.noScript);
                assertCleanPage();
                results.push(
                    `${options.noScript ? "static noscript" : host.name}: View projection and footnotes retain their fragment targets`,
                );
                await resourceLinkClicks(current, host, options.noScript);
                assertCleanPage();
                results.push(
                    `${options.noScript ? "static noscript" : host.name}: author links open raw resources with URI suffixes`,
                );
                continue;
            }
            await current.goto(`${host.origin}${host.root}/notes/images/`);
            const reader = current.locator('[data-reader="markdown"]');
            await reader.locator("img").first().waitFor();
            await current.waitForFunction(() => {
                const images = [...document.querySelectorAll('[data-reader="markdown"] img')];
                return images.length === 3 && images.every((image) => image.complete && image.naturalWidth > 0);
            });
            const parents = await reader
                .locator("img")
                .evaluateAll((images) => images.map((image) => image.parentElement.tagName));
            assert(JSON.stringify(parents) === '["P","P","A"]', `${host.name}: image wrapping changed: ${parents}`);
            assert(
                (await reader
                    .locator(
                        // Code samples and headings carry their own copy controls; any other button would belong to a viewer.
                        "[data-reader-image], [data-reader-image-expand], .forma-image-frame, .forma-image-link, button:not([data-reader-copy-code], [data-reader-heading-link]), dialog",
                    )
                    .count()) === 0,
                `${host.name}: image viewer returned`,
            );
            const image = reader.locator("img").first();
            assert((await image.getAttribute("title")) === "Wide visual fixture", `${host.name}: image title lost`);
            const before = current.url();
            const pageCount = context.pages().length;
            await image.click();
            await current.evaluate(
                () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
            );
            assert(
                current.url() === before &&
                    context.pages().length === pageCount &&
                    (await current.locator("dialog[open]").count()) === 0,
                `${host.name}: plain image click intercepted`,
            );
            await reader.locator("a").click();
            await current.waitForFunction(() => location.hash === "#forma-heading-image-viewer");
            results.push(`${host.name}: ordinary images and authored fragment link`);
            await current.goto(`${host.origin}${host.root}/notes/image-links/`);
            const linkedReader = current.locator(
                '[data-enhancement-ready] [data-reader="markdown"]:not([data-reader-loading])',
            );
            const external = linkedReader.locator('a[href="https://example.test/image-destination"]:has(img)');
            await external.waitFor();
            assert(
                (await external.count()) === 1 && (await external.getAttribute("target")) === "_blank",
                `${host.name}: external image destination changed`,
            );
            await context.route("https://example.test/image-destination", (route) =>
                route.fulfill({ status: 200, contentType: "text/html", body: "<h1>External image destination</h1>" }),
            );
            const popupReady = current.waitForEvent("popup");
            await external.click();
            const popup = await popupReady;
            await popup.waitForLoadState();
            assert(
                popup.url() === "https://example.test/image-destination",
                `${host.name}: external image click intercepted`,
            );
            await popup.close();
            await linkedReader.getByRole("link", { name: "Open image examples", exact: true }).click();
            await current.waitForURL((url) => url.pathname.replace(/\/$/u, "") === `${host.root}/notes/images`);
            await current.locator('[data-reader="markdown"] img').first().waitFor();
            results.push(`${host.name}: authored page and external image links`);
            if (host.name === "static") {
                await rawSource(current, host);
                results.push("static: raw source navigation beside sidecar");
            }
            await sidebarTreeFit(current, host);
            results.push(`${host.name}: long sidebar titles truncate without shifting the tree`);
            await directoryPage(current, host);
            results.push(`${host.name}: directory page opened directly`);
            if (host.name === "static") {
                await mountedDocument(current, host);
                results.push("static: mounted document retains identity, selection and links");
                await staticSystemRoutes(current, host);
                results.push("static: direct Health and reserved segment routes");
                await canonicalTerm(current, host);
                results.push("static: encoded canonical term URL enhances on direct load");
                await canonicalView(current, host);
                results.push("static: encoded canonical View URL enhances and navigates on direct load");
            }
            await routeLinks(current, host);
            results.push(`${host.name}: encoded source links and public routes retain their targets`);
            await crossSurfaceLinks(current, host);
            results.push(`${host.name}: reference links, wiki fragments and View anchors`);
            await markdownLinkContracts(current, host);
            results.push(`${host.name}: Markdown link origins and encoded heading fragments`);
            if (host.name === "static") {
                await resourceSuffix(current, host);
                results.push("static: resource query and fragment preserve URI semantics");
            }
            sourceCases.reading = await readingSyntax(current, host);
            results.push(`${host.name}: P1 syntax ${sourceCases.reading.length} cases, combined reading and themes`);
            sourceCases.callouts = await calloutSourceCases(current, host);
            results.push(
                `${host.name}: formatted callout samples and ${sourceCases.callouts.length} exact source cases`,
            );
            await callouts(current, host);
            results.push(`${host.name}: callout disclosure, rich header, navigation, focus and responsive themes`);

            await current.goto(`${host.origin}${host.root}/notes/viewers/`);
            const expand = current.getByRole("button", { name: "Expand Flowchart diagram", exact: true }).first();
            await expand.click();
            await current.locator("dialog[open]").waitFor();
            await current.keyboard.press("Escape");
            await current.locator("dialog[open]").waitFor({ state: "detached" });
            assert(
                await expand.evaluate((element) => element === document.activeElement),
                `${host.name}: Mermaid focus not restored`,
            );
            assert(
                await current.evaluate(() => document.body.style.overflow !== "hidden"),
                `${host.name}: scroll lock leaked`,
            );
            await mermaid(current, host);
            results.push(`${host.name}: Mermaid five kinds, empty class, themes, responsive viewer and focus`);

            await current.goto(`${host.origin}${host.root}${host.graph}`);
            const graph = current.getByRole("application");
            await graph.waitFor();
            await current.waitForFunction(() => {
                const graph = document.querySelector('[role="application"]');
                return graph && !graph.hasAttribute("aria-busy") && getComputedStyle(graph).visibility !== "hidden";
            });
            // The isolated graph has one node. Fit places it at its viewport center.
            await current.getByRole("button", { name: "Reset graph view", exact: true }).click();
            await graph.click();
            const selected = current.locator('p[title="graph/selected.md"]');
            await selected.waitFor();
            const opener = current.getByRole("button", { name: "Expand graph", exact: true });
            await opener.click();
            await current.locator("dialog[open]").waitFor();
            await selected.waitFor();
            await current.getByRole("button", { name: "Reset graph view", exact: true }).click();
            await current.keyboard.press("Escape");
            await current.locator("dialog[open]").waitFor({ state: "detached" });
            await selected.waitFor();
            assert(
                await opener.evaluate((element) => element === document.activeElement),
                `${host.name}: Graph focus not restored`,
            );
            assert(
                await current.evaluate(() => document.body.style.overflow !== "hidden"),
                `${host.name}: Graph scroll lock leaked`,
            );
            assertCleanPage();
            results.push(`${host.name}: Graph selection and focus retained`);
        } catch (error) {
            await failure(current, host.name, error, { errors, consoleErrors, failedRequests });
        } finally {
            await context.close();
        }
    }
    if (options.mode === "enhanced" || options.mode === "navigation") {
        return { status: "FORMA_MARKDOWN_BROWSER_PASSED", results, sourceCases };
    }
    const host = options.hosts.find((host) => host.name === "static");
    const context = await browser.newContext({ javaScriptEnabled: false });
    const current = await context.newPage();
    try {
        await current.goto(`${host.origin}${host.root}/notes/images/`);
        assert(
            await current.evaluate(() => {
                const script = document.createElement("script");
                script.textContent = "window.__formaScriptProbe = true";
                document.head.append(script);
                return window.__formaScriptProbe !== true;
            }),
            "noscript: page scripts unexpectedly execute",
        );
        const images = current.locator('[data-reader="markdown"] img');
        assert((await images.count()) === 3, "noscript: images missing");
        for (const image of await images.all()) {
            // Playwright evaluation works with page scripts disabled; do not inject app code.
            assert(
                await image.evaluate((image) => image.complete && image.naturalWidth > 0),
                "noscript: image failed to load",
            );
        }
        assert(
            JSON.stringify(await images.evaluateAll((images) => images.map((image) => image.parentElement.tagName))) ===
                '["P","P","A"]',
            "noscript: unexpected image wrappers",
        );
        await current.locator('[data-reader="markdown"] a').click();
        assert(current.url().endsWith("#forma-heading-image-viewer"), "noscript: authored fragment link broken");
        await current.goto(`${host.origin}${host.root}/notes/image-links/`);
        assert(
            (await current.locator('a[href="https://example.test/image-destination"] img').count()) === 1,
            "noscript: external image link changed",
        );
        await current.getByRole("link", { name: "Open image examples", exact: true }).click();
        await current.waitForURL((url) => url.pathname.replace(/\/$/u, "") === `${host.root}/notes/images`);
        await current.goto(`${host.origin}${host.root}/notes/viewers/`);
        assert((await current.locator("pre code.language-mermaid").count()) === 2, "noscript: Mermaid source missing");
        assert(
            (await current.getByRole("button", { name: /Expand/ }).count()) === 0,
            "noscript: inert viewer controls",
        );
        await current.goto(`${host.origin}${host.root}/notes/mermaid/`);
        assert(
            (await current.locator("pre code.language-mermaid").count()) === 7,
            "noscript: Mermaid kinds and empty source missing",
        );
        assert(
            (await current.locator(".mermaid-diagram, dialog, [data-mermaid-viewer]").count()) === 0,
            "noscript: inert Mermaid enhancement",
        );
        await current.goto(`${host.origin}${host.root}${host.graph}`);
        await current.getByRole("link", { name: "Selected node", exact: true }).click();
        await current.waitForURL((url) => url.pathname.replace(/\/$/u, "") === `${host.root}/graph/selected`);
        results.push("static noscript: images, authored link, Mermaid source and Graph navigation");
        await rawSource(current, host, true);
        results.push("static noscript: raw source navigation beside sidecar");
        sourceCases.reading = await readingSyntax(current, host, true);
        results.push(`static noscript: P1 syntax ${sourceCases.reading.length} cases and readable formula fallback`);
        sourceCases.callouts = await calloutSourceCases(current, host, true);
        results.push(
            `static noscript: formatted callout samples and ${sourceCases.callouts.length} exact source cases`,
        );
        await callouts(current, host, true);
        results.push("static noscript: callout defaults, pointer/keyboard and header links");
        await directoryPage(current, host, true);
        results.push("static noscript: directory page listing");
        await current.goto(`${host.origin}${host.root}/preview/`);
        await current.locator("main").getByRole("heading", { level: 1, name: "Folder landing" }).waitFor();
        await current.locator("main").getByRole("link", { name: "Mounted document" }).click();
        await current.locator("main").getByRole("heading", { level: 1, name: "Mounted document" }).waitFor();
        results.push("static noscript: directory landing document links to children");
        await staticSystemRoutes(current, host, true);
        results.push("static noscript: direct Health and reserved segment routes");
        await routeLinks(current, host, true);
        results.push("static noscript: encoded source links and public routes retain their targets");
        await crossSurfaceLinks(current, host, true);
        results.push("static noscript: reference links, wiki fragments and View anchors");
        await markdownLinkContracts(current, host, true);
        results.push("static noscript: Markdown link origins and encoded heading fragments");
        await resourceSuffix(current, host, true);
        results.push("static noscript: resource query and fragment preserve URI semantics");
    } catch (error) {
        await failure(current, "noscript", error);
    } finally {
        await context.close();
    }
    return { status: "FORMA_MARKDOWN_BROWSER_PASSED", results, sourceCases };
}
