import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { test as baseTest } from "@playwright/test";

import { observeReader, sectionHeading } from "../../scripts/reader-browser-diagnostics.mjs";
import {
    expectedStaticBrowserAssertions,
    runStaticNavigationFailureScenarios,
} from "../../scripts/static-navigation-browser-scenarios.mjs";

const test = baseTest.extend({
    staticPage: async ({ browser }, use) => {
        const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference" });
        try {
            await use(await context.newPage());
        } finally {
            await context.close();
        }
    },
});

async function browserChecks(page, staticPage, { origin, samples, fixture, base, root }, testInfo) {
    let assertions = 0;
    function expect(condition, diagnostic) {
        if (!condition) throw new Error(diagnostic);
    }
    const rpcRequests = [];
    page.on("request", (request) => {
        if (new URL(request.url()).pathname.endsWith("/-/rpc")) rpcRequests.push(request.url());
    });
    async function verifyLinkIcons(surface) {
        await surface.evaluate(async () => {
            const family = "Lucide Link Icons";
            for (const [kind, glyph] of Object.entries({ external: "\ue0b9", anchor: "\ue0ef" })) {
                const link = document.querySelector(`main a[data-link-kind="${kind}"]`);
                if (!link) throw new Error(`Missing ${kind} link in the browser fixture`);
                const icon = getComputedStyle(link, "::after");
                if (!icon.content.includes(glyph) || !icon.fontFamily.includes(family))
                    throw new Error(`Incorrect ${kind} link icon style`);
                const faces = await document.fonts.load(`16px "${family}"`, glyph).catch((error) => {
                    throw new Error(`Could not load the ${kind} link icon font: ${error.message}`);
                });
                if (faces.length === 0) throw new Error(`Missing font face for the ${kind} link icon`);
            }
        });
        assertions += 1;
    }
    async function currentTarget(probe, initialHeading) {
        await page.locator("[data-enhancement-ready][data-workspace-route]").waitFor({ timeout: 12_000 });
        const routes = await page.locator("[data-enhancement-ready]").getAttribute("data-workspace-route");
        expect(routes === probe.target.path, `Unexpected enhanced route ${routes}, expected ${probe.target.path}`);
        const boot = await page.locator("script[data-forma-static-workspace]").textContent();
        const target = JSON.parse(boot).pageTarget;
        expect(
            target.id === probe.target.id &&
                target.kind === probe.target.kind &&
                target.sourcePath === probe.target.sourcePath &&
                target.taxonomyId === probe.target.taxonomyId,
            `HTML target changed for ${probe.path}`,
        );
        expect(
            !(await page.locator("[data-static-fallback]").count()),
            `Static fallback survived enhancement: ${probe.path}`,
        );
        const main = page.locator("[data-enhancement-ready] main");
        if (["entry", "view", "taxonomy", "taxonomyTerm"].includes(probe.target.kind)) {
            await main
                .getByRole("heading", { level: 1, name: initialHeading, exact: true })
                .and(main.locator("h1").first())
                .waitFor({ timeout: 12_000 });
        } else {
            await main.locator("h1").first().waitFor({ timeout: 12_000 });
        }
    }
    const enhancedSnapshot = await observeReader(page);
    let snapshot = enhancedSnapshot;
    const initialSnapshot = await observeReader(staticPage);
    try {
        for (const probe of samples) {
            const url = origin + probe.path + "?keep=1&keep=2";
            snapshot = initialSnapshot;
            const response = await staticPage.goto(url);
            expect(
                response.status() === 200 && (await staticPage.locator("[data-static-fallback]").count()) === 1,
                `Initial static HTML failed ${probe.path}`,
            );
            const initialHeading = (await staticPage.locator("main h1").first().innerText()).trim();
            assertions += 1;
            const staticReload = await staticPage.reload();
            expect(
                staticReload.status() === 200 && (await staticPage.locator("[data-static-fallback]").count()) === 1,
                `Static refresh failed ${probe.path}`,
            );
            assertions += 1;
            snapshot = enhancedSnapshot;
            await page.goto(url);
            await currentTarget(probe, initialHeading);
            expect(new URL(page.url()).search === "?keep=1&keep=2", `Canonical route lost the query: ${probe.path}`);
            assertions += 1;
            await page.reload();
            await currentTarget(probe, initialHeading);
            assertions += 1;
        }
        if (fixture) {
            const home = origin + (root === "/" ? "/" : root);
            const target = root === "/" ? fixture.target : root + fixture.target;
            const url = origin + target + "?keep=1&keep=2#fixture-section";
            snapshot = initialSnapshot;
            await staticPage.goto(url);
            expect(
                await staticPage.evaluate(() => document.querySelector(":target")?.id === "fixture-section"),
                "Static direct fragment did not identify the section",
            );
            assertions += 1;
            await staticPage.goto(home);
            await staticPage.getByRole("link", { name: "Cloudflare fixture link", exact: true }).click();
            await staticPage.waitForURL(url);
            expect(
                await staticPage.evaluate(() => document.querySelector(":target")?.id === "fixture-section"),
                "Static link click did not retain the explicit query and fragment",
            );
            assertions += 1;
            snapshot = enhancedSnapshot;
            await page.goto(url);
            await sectionHeading(page, "fixture-section", "Fixture Section").waitFor({ timeout: 12_000 });
            expect(
                await page.evaluate(
                    () => location.hash === "#fixture-section" && !!document.getElementById("fixture-section"),
                ),
                "Direct enhancement did not retain the fragment target",
            );
            assertions += 1;
            await verifyLinkIcons(page);
            assertions += await runStaticNavigationFailureScenarios(
                page,
                { origin, base, root, fixture },
                observeReader,
            );
        }
        expect(rpcRequests.length === 0, `Static enhancement attempted RPC: ${rpcRequests.join(", ")}`);
        return assertions;
    } catch (error) {
        const details = JSON.stringify(await snapshot().catch((cause) => ({ captureError: cause.message })));
        const failure = new Error(`${error.message}\nDiagnostics: ${details}`, { cause: error });
        try {
            await testInfo.attach("cloudflare-reader-diagnostics", {
                body: details,
                contentType: "application/json",
            });
        } finally {
            throw failure;
        }
    }
}

for (const name of ["positive-root", "positive-preview", "candidate"]) {
    test(name, async ({ browser, page, staticPage }, testInfo) => {
        const path = process.env.FORMA_CLOUDFLARE_BROWSER_INPUT;
        assert(path, "Set FORMA_CLOUDFLARE_BROWSER_INPUT to the Cloudflare gate's browser plan");
        const inputs = JSON.parse(await readFile(path, "utf8"));
        const input = inputs[name];
        assert(
            input && Array.isArray(input.samples) && input.samples.length > 0,
            `Missing browser samples for ${name}`,
        );
        assert.equal(input.root, name === "positive-preview" ? "/preview" : "/");
        assert.equal(Boolean(input.fixture), name !== "candidate", `Unexpected fixture for ${name}`);

        const assertions = await browserChecks(page, staticPage, input, testInfo);
        assert.equal(
            assertions,
            expectedStaticBrowserAssertions(input.samples, input.fixture),
            "Browser assertions incomplete",
        );
        await testInfo.attach("cloudflare-browser-coverage", {
            body: JSON.stringify({ name, assertions, browserVersion: browser.version() }),
            contentType: "application/json",
        });
    });
}
