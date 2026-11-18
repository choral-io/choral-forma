// Generate a playwright-cli run-code file for a public reader section, then run it in an isolated browser session.
// node scripts/reader-section-probe.mjs '<canonical URL with #fragment>' '<accessible heading>' > /tmp/section.cjs
import { observeReader, sectionHeading } from "./reader-browser-diagnostics.mjs";

export async function checkSection(
    page,
    url,
    id,
    name,
    observe,
    heading,
    { timeout = 10_000, through = "refresh" } = {},
) {
    const snapshot = await observe(page);
    const phases = through === "direct" ? ["direct"] : ["direct", "refresh"];
    for (const phase of phases) {
        const section = heading(page, id, name);
        let step = "navigation";
        let geometryTimedOut = false;
        try {
            const response = phase === "direct" ? await page.goto(url) : await page.reload();
            if (!response?.ok()) throw new Error(`Document returned ${response?.status()}`);
            step = "heading";
            await section.waitFor();
            step = "geometry";
            const deadline = Date.now() + timeout;
            while (
                !(await section.evaluateAll(([target, other], id) => {
                    if (!target || other || document.getElementById(id) !== target) return false;
                    const reader = target.closest("main");
                    if (!reader) return false;
                    const bounds = target.getBoundingClientRect();
                    if (
                        !bounds.height ||
                        !bounds.width ||
                        bounds.top < 0 ||
                        bounds.bottom > innerHeight ||
                        bounds.left < 0 ||
                        bounds.right > innerWidth
                    ) {
                        return false;
                    }
                    for (
                        let ancestor = target.parentElement;
                        ancestor && ancestor !== document.body;
                        ancestor = ancestor.parentElement
                    ) {
                        const { overflowX, overflowY } = getComputedStyle(ancestor);
                        const ancestorBounds = ancestor.getBoundingClientRect();
                        const top = ancestorBounds.top + ancestor.clientTop;
                        const left = ancestorBounds.left + ancestor.clientLeft;
                        // Client dimensions are integer pixels even when the viewport box is fractional.
                        if (
                            ((ancestor === reader || overflowY !== "visible") &&
                                (bounds.top < top - 1 || bounds.bottom > top + ancestor.clientHeight + 1)) ||
                            ((ancestor === reader || overflowX !== "visible") &&
                                (bounds.left < left - 1 || bounds.right > left + ancestor.clientWidth + 1))
                        ) {
                            return false;
                        }
                    }
                    return true;
                }, id))
            ) {
                const remaining = deadline - Date.now();
                if (remaining <= 0) {
                    geometryTimedOut = true;
                    throw new Error(`Section did not reach the visible reader area within ${timeout}ms`);
                }
                await page.waitForTimeout(Math.min(25, remaining));
            }
            step = "URL";
            if (page.url() !== url) throw new Error(`Unexpected URL ${page.url()}`);
        } catch (error) {
            const [diagnostics, landing] = await Promise.all([
                snapshot(id).catch((error) => ({ captureError: error.message })),
                section
                    .evaluateAll((headings) => {
                        function describe(element) {
                            return element
                                ? {
                                      id: element.id,
                                      tag: element.tagName,
                                      html: element.outerHTML.slice(0, 300),
                                      bounds: element.getBoundingClientRect().toJSON(),
                                  }
                                : null;
                        }
                        let fragment = location.hash.slice(1);
                        try {
                            fragment = decodeURIComponent(fragment);
                        } catch {
                            // Retain malformed fragments for the failure report.
                        }
                        const target = fragment ? document.getElementById(fragment) : null;
                        const expectedHeading = headings[0];
                        const reader = expectedHeading?.closest("main");
                        return {
                            fragment,
                            fragmentTarget: describe(target),
                            nativeTarget: describe(document.querySelector(":target")),
                            expectedHeading: describe(expectedHeading),
                            expectedMatches: headings.length,
                            ownsFragment: headings.length === 1 && expectedHeading === target,
                            readerClip: reader
                                ? {
                                      bottom:
                                          reader.getBoundingClientRect().top + reader.clientTop + reader.clientHeight,
                                      overflowY: getComputedStyle(reader).overflowY,
                                  }
                                : null,
                        };
                    })
                    .catch((error) => ({ captureError: error.message })),
            ]);
            const message = error instanceof Error ? error.message : String(error);
            const failure = new Error(
                `${phase}: ${message}\nDiagnostics: ${JSON.stringify({ ...diagnostics, landing })}`,
                { cause: error },
            );
            // A browser or locator error during a geometry sample is distinct from reaching the retry deadline.
            const timedOut = geometryTimedOut || (step === "heading" && error?.name === "TimeoutError");
            throw Object.assign(failure, { phase, step, timedOut, landing });
        }
    }
    return { direct: true, refresh: through !== "direct", url, name };
}

if (import.meta.main) {
    const url = new URL(process.argv[2]);
    const id = decodeURIComponent(url.hash.slice(1));
    const name = process.argv[3];
    if (!id || !name) throw new Error("Expected a canonical section URL and exact accessible heading");
    console.log(
        `async page => (${checkSection})(page, ${JSON.stringify(url.href)}, ${JSON.stringify(id)}, ${JSON.stringify(name)}, ${observeReader}, ${sectionHeading})`,
    );
}
