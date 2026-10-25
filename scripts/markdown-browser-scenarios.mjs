/** Runs against real WebApp/static hosts; serialized into playwright-cli's isolated runner. */
export async function markdownBrowserScenarios(page, options) {
    const assert = (condition, message) => {
        if (!condition) throw new Error(message);
    };
    const results = [];
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
    const calloutSourceCases = async (current, host, noScript = false) => {
        assert(
            Array.isArray(options.calloutBoundaries) && options.calloutBoundaries.length > 0,
            `${host.name}: exact callout source cases missing`,
        );
        for (const [name, types, quotes] of [
            ["callouts", ["note", "tip", "important", "warning", "caution"], 7],
            ["callout-review", ["note", "tip", "important"], 2],
        ]) {
            await current.goto(`${host.origin}${host.root}/pages/notes/${name}/`);
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
        await current.goto(`${host.origin}${host.root}/pages/notes/callout-boundaries/`);
        if (!noScript) await current.locator("[data-enhancement-ready]").waitFor();
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
        }
    };
    const callouts = async (current, host, noScript = false) => {
        await current.bringToFront();
        await current.goto(`${host.origin}${host.root}/pages/notes/callout-interaction/`);
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
            await current.waitForFunction(
                (open) => document.querySelector("details[data-callout-fold]")?.open === open,
                open,
            );
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
            await current.locator(`a[href$="#${returnId}"]`).click();
            await state(true);
            await current.waitForFunction((id) => document.activeElement?.id === id, returnId);
            assert(
                await current.evaluate((id) => document.activeElement?.id === id, returnId),
                `${host.name}: return focus lost`,
            );
            await current.reload();
            await state(true);
            await toggle();
            await state(false);
            await titleLink.click();
            await current.goBack();
            await state(true);
        }
        await current.goto(`${host.origin}${host.root}/pages/notes/callout-layout/`);
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
    const browser = page.context().browser();
    for (const host of options.hosts) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const current = await context.newPage();
        const errors = [];
        const consoleErrors = [];
        const failedRequests = [];
        current.on("console", (message) => {
            if (message.type() === "error") consoleErrors.push(message.text());
        });
        current.on("requestfailed", (request) => {
            if (!request.failure()?.errorText.includes("ABORTED"))
                failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
        });
        current.on("pageerror", (error) => errors.push(error.message));
        try {
            await current.goto(`${host.origin}${host.root}/pages/notes/images/`);
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
                        "[data-reader-image], [data-reader-image-expand], .forma-image-frame, .forma-image-link, button, dialog",
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
            await current.goto(`${host.origin}${host.root}/pages/notes/image-links/`);
            const linkedReader = current.locator('[data-reader="markdown"]');
            await linkedReader.locator("img").first().waitFor();
            const external = linkedReader.locator('a[href="https://example.test/image-destination"]');
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
            await current.waitForURL((url) => url.pathname.replace(/\/$/u, "") === `${host.root}/pages/notes/images`);
            await current.locator('[data-reader="markdown"] img').first().waitFor();
            results.push(`${host.name}: authored page and external image links`);
            await calloutSourceCases(current, host);
            results.push(
                `${host.name}: formatted callout samples and ${options.calloutBoundaries.length} exact source cases`,
            );
            await callouts(current, host);
            results.push(`${host.name}: callout disclosure, rich header, navigation, focus and responsive themes`);

            await current.goto(`${host.origin}${host.root}/pages/notes/viewers/`);
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
            results.push(`${host.name}: Mermaid focus restoration`);

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
            assert(errors.length === 0, `${host.name}: page errors: ${errors.join("; ")}`);
            assert(consoleErrors.length === 0, `${host.name}: console errors: ${consoleErrors.join("; ")}`);
            assert(failedRequests.length === 0, `${host.name}: failed requests: ${JSON.stringify(failedRequests)}`);
            results.push(`${host.name}: Graph selection and focus retained`);
        } catch (error) {
            await failure(current, host.name, error, { errors, consoleErrors, failedRequests });
        } finally {
            await context.close();
        }
    }
    const host = options.hosts.find((host) => host.name === "static");
    const context = await browser.newContext({ javaScriptEnabled: false });
    const current = await context.newPage();
    try {
        await current.goto(`${host.origin}${host.root}/pages/notes/images/`);
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
        await current.goto(`${host.origin}${host.root}/pages/notes/image-links/`);
        assert(
            (await current.locator('a[href="https://example.test/image-destination"] img').count()) === 1,
            "noscript: external image link changed",
        );
        await current.getByRole("link", { name: "Open image examples", exact: true }).click();
        await current.waitForURL((url) => url.pathname.replace(/\/$/u, "") === `${host.root}/pages/notes/images`);
        await current.goto(`${host.origin}${host.root}/pages/notes/viewers/`);
        assert((await current.locator("pre code.language-mermaid").count()) === 2, "noscript: Mermaid source missing");
        assert(
            (await current.getByRole("button", { name: /Expand/ }).count()) === 0,
            "noscript: inert viewer controls",
        );
        await current.goto(`${host.origin}${host.root}${host.graph}`);
        await current.getByRole("link", { name: "Selected node", exact: true }).click();
        await current.waitForURL((url) => url.pathname.replace(/\/$/u, "") === `${host.root}/pages/graph/selected`);
        results.push("static noscript: images, authored link, Mermaid source and Graph navigation");
        await calloutSourceCases(current, host, true);
        results.push(
            `static noscript: formatted callout samples and ${options.calloutBoundaries.length} exact source cases`,
        );
        await callouts(current, host, true);
        results.push("static noscript: callout defaults, pointer/keyboard and header links");
    } catch (error) {
        await failure(current, "noscript", error);
    } finally {
        await context.close();
    }
    return { status: "FORMA_MARKDOWN_BROWSER_PASSED", results };
}
