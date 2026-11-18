// Generate a playwright-cli run-code file for a public reader section, then run it in an isolated browser session.
// node scripts/reader-section-probe.mjs '<canonical URL with #fragment>' '<accessible heading>' > /tmp/section.cjs
import { observeReader, sectionHeading } from "./reader-browser-diagnostics.mjs";

export async function checkSection(page, url, id, name, observe, heading, timeout = 10_000) {
    const snapshot = await observe(page);
    for (const phase of ["direct", "refresh"]) {
        try {
            const response = phase === "direct" ? await page.goto(url) : await page.reload();
            if (!response?.ok()) throw new Error(`Document returned ${response?.status()}`);
            const section = heading(page, id, name);
            await section.waitFor();
            const target = await section.elementHandle();
            try {
                await page.waitForFunction(
                    (target) => {
                        if (!target.isConnected || document.getElementById(target.id) !== target) return false;
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
                    },
                    target,
                    { timeout },
                );
            } finally {
                await target.dispose();
            }
            if (page.url() !== url) throw new Error(`Unexpected URL ${page.url()}`);
        } catch (error) {
            throw new Error(`${phase}: ${error.message}\nDiagnostics: ${JSON.stringify(await snapshot(id))}`);
        }
    }
    return { direct: true, refresh: true, url, name };
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
