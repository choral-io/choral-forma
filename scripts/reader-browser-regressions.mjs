export const readerBrowserChecks = [
    "reader section: duplicate fragment target rejected on direct and refresh",
    "reader section: clipped heading rejected on direct and refresh",
    "reader diagnostics: captures the URL at each focus attempt",
    "reader diagnostics: attributes requests across documents and reloads",
];

/** Runs in Playwright's isolated browser runner. All fixture requests are intercepted. */
export async function readerBrowserRegressions(page, checks, checkSection, observe, sectionHeading) {
    const browser = page.context().browser();
    const origin = "http://forma-reader-fixture.test";
    function assert(condition, message) {
        if (!condition) throw new Error(message);
    }
    async function fixture(serve, test) {
        const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
        try {
            const current = await context.newPage();
            await current.route(origin + "/**", async (route) => {
                const response = await serve(new URL(route.request().url()).pathname);
                await route.fulfill({ contentType: "text/html", ...response });
            });
            await test(current);
        } finally {
            await context.close();
        }
    }
    const heading = '<h2 id="section">Project Setup <span aria-hidden="true">#</span></h2>';
    const reader = (content, style = "") =>
        `<div data-enhancement-ready><main style="${style}">${content}</main></div>`;
    const normal = reader(heading);
    const section = (current) =>
        checkSection(
            current,
            origin + "/guide?tag=one&tag=two#section",
            "section",
            "Project Setup",
            observe,
            sectionHeading,
            800,
        );
    await fixture(
        () => ({ body: normal }),
        async (current) => {
            const result = await section(current);
            assert(result.direct && result.refresh, "Visible heading should pass on direct and refresh");
        },
    );
    const sections = [
        '<aside id="section">Wrong fragment owner</aside>' +
            reader('<div style="height:1200px"></div>' + heading, "height:250px;overflow:auto"),
        reader(
            heading.replace("<h2 ", '<h2 style="position:absolute;top:240px" '),
            "position:relative;height:100px;overflow:clip",
        ),
    ];
    const testCases = sections.map((badBody) => async () => {
        for (const phase of ["direct", "refresh"]) {
            let documents = 0;
            await fixture(
                (pathname) => ({
                    body: phase === "refresh" && pathname === "/guide" && documents++ === 0 ? normal : badBody,
                }),
                async (current) => {
                    const error = await section(current).then(
                        () => null,
                        (error) => error,
                    );
                    assert(
                        error?.message.startsWith(`${phase}: `) && error.message.includes("Timeout"),
                        `${phase}: offscreen or misdirected section passed or failed for another reason: ${error?.message}`,
                    );
                },
            );
        }
    });
    testCases.push(async () => {
        const body = '<a href="#note" id="section" data-user-content-fn-ref>Reference</a>';
        for (const beforeRetry of [true, false]) {
            await fixture(
                () => ({ body }),
                async (current) => {
                    const snapshot = await observe(current);
                    await current.goto(origin + "/guide#before");
                    await current.evaluate((beforeRetry) => {
                        const target = document.getElementById("section");
                        target.focus();
                        if (beforeRetry) history.replaceState(null, "", "#section");
                        target.focus();
                        if (!beforeRetry) history.replaceState(null, "", "#section");
                    }, beforeRetry);
                    const { state } = await snapshot("section");
                    const actual = state.focusAttempts.map((attempt) => attempt.url);
                    const expected = [
                        origin + "/guide#before",
                        origin + (beforeRetry ? "/guide#section" : "/guide#before"),
                    ];
                    assert(
                        JSON.stringify(actual) === JSON.stringify(expected),
                        `Unexpected focus URLs: ${JSON.stringify(actual)}`,
                    );
                },
            );
        }
    });
    testCases.push(async () => {
        await fixture(
            (pathname) => ({
                body: pathname,
                status: pathname.endsWith("-dashboard") ? 503 : 200,
            }),
            async (current) => {
                const snapshot = await observe(current);
                async function dashboard(path) {
                    const finished = current.waitForEvent(
                        "requestfinished",
                        (request) => request.url() === origin + path,
                    );
                    await current.evaluate((path) => fetch(path).then((response) => response.text()), path);
                    await finished;
                }
                await current.goto(origin + "/previous");
                await dashboard("/old-dashboard");
                await current.goto(origin + "/guide#section");
                await dashboard("/current-dashboard");
                const first = await snapshot();
                assert(
                    first.failedRequests.length === 2 &&
                        first.failedRequests[0].document?.url === origin + "/previous" &&
                        first.failedRequests[1].document?.id === first.document?.id &&
                        first.failedRequests[0].document.id !== first.document.id,
                    "Requests from the previous and current documents are indistinguishable",
                );
                await current.evaluate(() => history.replaceState(null, "", "#another-section"));
                await dashboard("/same-document-dashboard");
                assert(
                    (await snapshot()).failedRequests.at(-1).document?.id === first.document.id,
                    "Hash changes must preserve the current document ID",
                );
                await current.reload();
                await dashboard("/current-dashboard");
                const reloaded = await snapshot();
                assert(
                    reloaded.document?.id !== first.document.id &&
                        reloaded.document?.url === origin + "/guide" &&
                        reloaded.failedRequests.at(-1).document?.id === reloaded.document.id,
                    "Reload must receive a separate document ID",
                );
            },
        );
    });
    const results = [];
    const failures = [];
    for (const [index, test] of testCases.entries()) {
        try {
            await test();
            results.push(checks[index]);
        } catch (error) {
            failures.push(`${checks[index]}: ${error.message}`);
        }
    }
    if (failures.length) throw new Error(failures.join("\n"));
    return { status: "FORMA_MARKDOWN_BROWSER_PASSED", results, sourceCases: {} };
}
