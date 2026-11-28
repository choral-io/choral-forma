import assert from "node:assert/strict";

import { test as base } from "@playwright/test";

import { observeReader, sectionHeading } from "../../scripts/reader-browser-diagnostics.mjs";
import { checkSection } from "../../scripts/reader-section-probe.mjs";

const origin = "http://forma-reader-fixture.test";
const observations = new WeakMap();

function observe(page) {
    if (!observations.has(page)) observations.set(page, observeReader(page));
    return observations.get(page);
}

const test = base.extend({
    fixture: async ({ browser }, use, testInfo) => {
        await use(async (respond, run) => {
            const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
            try {
                const page = await context.newPage();
                const snapshot = await observe(page);
                await page.route(origin + "/**", async (route) => {
                    const response = await respond(new URL(route.request().url()).pathname);
                    await route.fulfill({ contentType: "text/html", ...response });
                });
                try {
                    await run(page);
                } catch (error) {
                    const details = await snapshot("section").catch((error) => ({ captureError: error.message }));
                    await testInfo.attach("reader-diagnostics", {
                        body: JSON.stringify({ url: page.url(), ...details }, null, 2),
                        contentType: "application/json",
                    });
                    throw error;
                }
            } finally {
                await context.close();
            }
        });
    },
});

const heading = '<h2 id="section">Project Setup <span aria-hidden="true">#</span></h2>';
const reader = (content, style = "") => `<div data-enhancement-ready><main style="${style}">${content}</main></div>`;
const normal = reader(heading);
const section = (current, through, locate = sectionHeading) =>
    checkSection(current, origin + "/guide?tag=one&tag=two#section", "section", "Project Setup", observe, locate, {
        timeout: 800,
        through,
    });
async function expectSectionTimeout(current, phase, step, locate) {
    const failure = await section(current, phase, locate).then(
        () => {
            throw new Error(`${phase}: section probe unexpectedly passed`);
        },
        (error) => error,
    );
    if (failure?.phase !== phase || failure.step !== step || !failure.timedOut) {
        const cause = failure?.cause ?? failure;
        const reason = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
        const context = failure?.step ? ` during ${failure.step}` : "";
        throw new Error(
            `${failure?.phase ?? phase}: section probe failed with an unexpected error${context}: ${reason}`,
            { cause: failure },
        );
    }
    return failure.landing;
}
async function expectClippedHeading(current, phase, locate) {
    const landing = await expectSectionTimeout(current, phase, "geometry", locate);
    assert(
        landing.fragment === "section" &&
            landing.ownsFragment &&
            landing.expectedHeading?.tag === "H2" &&
            landing.expectedHeading.id === "section" &&
            landing.expectedHeading.bounds.height > 0 &&
            landing.readerClip?.overflowY === "clip" &&
            landing.expectedHeading.bounds.top >= landing.readerClip.bottom,
        `${phase}: geometry timeout did not show a clipped fragment heading: ${JSON.stringify(landing)}`,
    );
    return landing;
}
function changeHeadingAfterMiss(change, options) {
    let changed = false;
    return (page, id, name) => {
        const locator = sectionHeading(page, id, name);
        const evaluateAll = locator.evaluateAll.bind(locator);
        locator.evaluateAll = async (...args) => {
            const result = await evaluateAll(...args);
            if (result === false && !changed) {
                changed = true;
                await evaluateAll(change, options);
            }
            return result;
        };
        return locator;
    };
}

const sections = [
    // Keep the heading visible so only fragment ownership can reject this landing.
    '<aside id="section">Wrong fragment owner</aside>' + normal,
    reader(
        heading.replace("<h2 ", '<h2 style="position:absolute;top:240px" '),
        "position:relative;height:100px;overflow:clip",
    ),
];
for (const [index, badBody] of sections.entries()) {
    test(
        index === 0
            ? "reader section: duplicate fragment target rejected on direct and refresh"
            : "reader section: clipped heading rejected on direct and refresh",
        async ({ fixture }) => {
            for (const phase of ["direct", "refresh"]) {
                let documents = 0;
                await fixture(
                    (pathname) => ({
                        body: phase === "refresh" && pathname === "/guide" && documents++ === 0 ? normal : badBody,
                    }),
                    async (current) => {
                        if (index !== 0) {
                            await expectClippedHeading(current, phase);
                        } else {
                            const landing = await expectSectionTimeout(current, phase, "geometry");
                            assert(
                                landing.fragment === "section" &&
                                    landing.fragmentTarget?.tag === "ASIDE" &&
                                    landing.fragmentTarget.id === "section" &&
                                    landing.nativeTarget?.tag === "ASIDE" &&
                                    landing.fragmentTarget.bounds.height > 0 &&
                                    landing.expectedHeading?.tag === "H2" &&
                                    landing.expectedHeading.id === "section" &&
                                    landing.expectedHeading.bounds.height > 0 &&
                                    landing.fragmentTarget.bounds.bottom <= landing.expectedHeading.bounds.top &&
                                    landing.expectedHeading.bounds.bottom <= 600 &&
                                    landing.expectedMatches === 1,
                                `${phase}: missing fragment owner or visible expected heading: ${JSON.stringify(landing)}`,
                            );
                        }
                    },
                );
            }
            if (index !== 0) {
                for (const phase of ["direct", "refresh"]) {
                    for (const visible of [true, false]) {
                        let documents = 0;
                        await fixture(
                            (pathname) => ({
                                body:
                                    phase === "refresh" && pathname === "/guide" && documents++ === 0
                                        ? normal
                                        : badBody,
                            }),
                            async (current) => {
                                const locate = changeHeadingAfterMiss(([original], visible) => {
                                    const replacement = original.cloneNode(true);
                                    replacement.dataset.remountedHeading = "";
                                    if (visible) original.closest("main").style.height = "400px";
                                    original.replaceWith(replacement);
                                }, visible);
                                if (visible) {
                                    const result = await section(current, phase, locate);
                                    assert(result[phase], `${phase}: visible replacement did not land`);
                                } else {
                                    const landing = await expectClippedHeading(current, phase, locate);
                                    assert(
                                        landing.expectedHeading?.html.includes("data-remounted-heading") &&
                                            landing.fragmentTarget?.html.includes("data-remounted-heading"),
                                        `${phase}: missing clipped replacement in the failure snapshot`,
                                    );
                                }
                                const fits = await current
                                    .locator("main h2[data-remounted-heading]")
                                    .evaluate((heading) => {
                                        const bounds = heading.getBoundingClientRect();
                                        const readerBounds = heading.closest("main").getBoundingClientRect();
                                        return bounds.top >= readerBounds.top && bounds.bottom <= readerBounds.bottom;
                                    });
                                assert(fits === visible, `${phase}: replacement must have the intended visibility`);
                            },
                        );
                    }
                    let documents = 0;
                    await fixture(
                        (pathname) => ({
                            body: phase === "refresh" && pathname === "/guide" && documents++ === 0 ? normal : badBody,
                        }),
                        async (current) => {
                            const remove = changeHeadingAfterMiss(([original]) => original.remove());
                            const error = await expectClippedHeading(current, phase, remove).then(
                                () => null,
                                (error) => error,
                            );
                            assert(
                                error?.message.startsWith(
                                    `${phase}: geometry timeout did not show a clipped fragment heading`,
                                ) && (await current.locator("main h2").count()) === 0,
                                `${phase}: a heading that disappeared was accepted as clipped`,
                            );
                        },
                    );
                }
                return;
            }
            for (const removed of [false, true]) {
                await fixture(
                    () => ({
                        body: '<aside id="section">Only fragment owner</aside>' + reader(removed ? heading : ""),
                    }),
                    async (current) => {
                        current.setDefaultTimeout(800);
                        const locate = removed
                            ? changeHeadingAfterMiss(([original]) => original.remove())
                            : sectionHeading;
                        const landing = await expectSectionTimeout(
                            current,
                            "direct",
                            removed ? "geometry" : "heading",
                            locate,
                        );
                        assert(
                            landing.fragmentTarget?.tag === "ASIDE" &&
                                landing.expectedHeading === null &&
                                landing.expectedMatches === 0,
                            `Missing heading was not reported: ${JSON.stringify(landing)}`,
                        );
                    },
                );
            }
        },
    );
}

test("reader diagnostics: captures the URL at each focus attempt", async ({ fixture }) => {
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
test("reader diagnostics: attributes requests across documents and reloads", async ({ fixture }) => {
    await fixture(
        (pathname) => ({
            body: pathname,
            status: pathname.endsWith("-dashboard") ? 503 : 200,
        }),
        async (current) => {
            const snapshot = await observe(current);
            async function dashboard(path) {
                const finished = current.waitForEvent("requestfinished", (request) => request.url() === origin + path);
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
test("reader section: preserves the phase, step and cause of heading and geometry failures", async ({ fixture }) => {
    for (const phase of ["direct", "refresh"]) {
        const expectedLoads = phase === "direct" ? 1 : 2;
        for (const fault of ["missing heading", "TypeError", "TimeoutError"]) {
            const missing = fault === "missing heading";
            let loads = 0;
            await fixture(
                (path) => {
                    if (path === "/guide") loads++;
                    return { body: missing && loads === expectedLoads ? reader("") : normal };
                },
                async (current) => {
                    current.setDefaultTimeout(800);
                    const injected = new TypeError("Injected TimeoutPolicy geometry failure");
                    if (fault === "TimeoutError") injected.name = fault;
                    const locate = (page, id, name) => {
                        const locator = sectionHeading(page, id, name);
                        const evaluateAll = locator.evaluateAll.bind(locator);
                        let pending = !missing;
                        locator.evaluateAll = (...args) => {
                            if (pending && loads === expectedLoads) {
                                pending = false;
                                throw injected;
                            }
                            return evaluateAll(...args);
                        };
                        return locator;
                    };
                    const failure = await section(current, phase, locate).then(
                        () => null,
                        (error) => error,
                    );
                    const step = missing ? "heading" : "geometry";
                    const cause = failure?.cause;
                    assert(
                        loads === expectedLoads &&
                            failure?.phase === phase &&
                            failure.step === step &&
                            failure.timedOut === missing &&
                            (missing
                                ? cause?.name === "TimeoutError" && cause.message.includes("locator.waitFor")
                                : cause === injected),
                        `${phase}: ${fault} expected ${step} timedOut=${missing} after ${expectedLoads} document(s); got ${failure?.phase}/${failure?.step} timedOut=${failure?.timedOut}, cause=${cause?.name}: ${cause?.message}, loads=${loads}`,
                    );
                },
            );
        }
    }
});
test("reader section: distinguishes a document reload from reopening the URL", async ({ fixture }) => {
    const body =
        normal +
        `<script>
        const visits = JSON.parse(sessionStorage.getItem("guideVisits") || "[]");
        visits.push(performance.getEntriesByType("navigation")[0]?.type);
        sessionStorage.setItem("guideVisits", JSON.stringify(visits));
    </script>`;
    for (const phase of ["direct", "refresh"]) {
        await fixture(
            () => ({ body }),
            async (current) => {
                let documents = 0;
                current.on("request", (request) => {
                    if (
                        request.isNavigationRequest() &&
                        request.frame() === current.mainFrame() &&
                        new URL(request.url()).pathname === "/guide"
                    )
                        documents++;
                });
                const result = await section(current, phase);
                const types = await current.evaluate(() => JSON.parse(sessionStorage.getItem("guideVisits")));
                const expected = phase === "direct" ? ["navigate"] : ["navigate", "reload"];
                assert(
                    result.direct &&
                        result.refresh === (phase === "refresh") &&
                        documents === expected.length &&
                        JSON.stringify(types) === JSON.stringify(expected),
                    `${phase}: expected ${expected.length} guide document(s) with navigation ${expected}; got ${documents} with ${types}`,
                );
            },
        );
    }
});
