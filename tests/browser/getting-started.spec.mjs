import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { test as base, expect } from "@playwright/test";

import { closeStaticServer, startStaticServer } from "../../scripts/browser-static-host.mjs";
import { observeReader } from "../../scripts/reader-browser-diagnostics.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const execute = promisify(execFile);
const staticRoot = "/preview";

const test = base.extend({
    staticSite: [
        async ({}, use) => {
            const temporary = await mkdtemp(join(await realpath(tmpdir()), "forma-getting-started-"));
            const output = join(temporary, "site");
            try {
                const { server, origin } = await startStaticServer(staticRoot, output);
                try {
                    const binary = join(root, "target", "debug", process.platform === "win32" ? "forma.exe" : "forma");
                    const { stdout } = await execute(
                        binary,
                        [
                            "--workspace",
                            "examples/getting-started-workspace",
                            "site",
                            "build",
                            "--out",
                            output,
                            "--base-url",
                            origin,
                            "--root-path",
                            staticRoot,
                            "--json",
                        ],
                        { cwd: root, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
                    ).catch((error) => {
                        throw new Error(
                            `Getting Started static build failed:\n${error.stdout ?? ""}${error.stderr ?? ""}`,
                            {
                                cause: error,
                            },
                        );
                    });
                    const { status, diagnostics } = JSON.parse(stdout);
                    expect({ status, diagnostics }, "Getting Started static build result").toEqual({
                        status: "passed",
                        diagnostics: [],
                    });
                    await use({ origin, build: stdout });
                } finally {
                    await closeStaticServer(server);
                }
            } finally {
                await rm(temporary, { recursive: true, force: true });
            }
        },
        { scope: "worker" },
    ],
    page: async ({ page }, use, testInfo) => {
        const snapshot = await observeReader(page);
        await use(page);
        if (testInfo.status !== testInfo.expectedStatus) {
            const details = await snapshot().catch((error) => ({ captureError: error.message }));
            await testInfo.attach("reader-diagnostics", {
                body: JSON.stringify({ url: page.url(), ...details }, null, 2),
                contentType: "application/json",
            });
        }
    },
});

for (const [surface, mount, javaScriptEnabled] of [
    ["WebApp", "", true],
    ["static enhanced", staticRoot, true],
    ["static without JavaScript", staticRoot, false],
]) {
    test.describe(surface, () => {
        test.use({ javaScriptEnabled });

        test("directory and exact index document", async ({ page, staticSite }, testInfo) => {
            const url = mount
                ? staticSite.origin + mount
                : `http://127.0.0.1:${process.env.FORMA_GETTING_STARTED_PORT}`;
            if (mount) {
                await testInfo.attach("static-build", { body: staticSite.build, contentType: "application/json" });
            }
            if (javaScriptEnabled) {
                await page.addInitScript(() => {
                    Object.defineProperty(navigator, "clipboard", {
                        value: {
                            async writeText(value) {
                                window.formaTestCopiedPath = value;
                            },
                        },
                    });
                });
            }
            const main = page.locator(javaScriptEnabled ? "[data-enhancement-ready] main" : "main");
            const listing = javaScriptEnabled
                ? main.getByRole("list", { name: "Pages", exact: true })
                : main
                      .locator("section")
                      .filter({ has: page.getByRole("heading", { name: "Entries", exact: true }) })
                      .getByRole("list");
            const intro = main.locator('[data-reader="markdown"]');
            const authoredLink = intro.getByRole("link", { name: "Learn how to link notes", exact: true });
            const fragmentState = javaScriptEnabled ? "focus" : "target";
            const indexPath = "notes/index.md";
            const expectRoute = (path, hash = "") =>
                expect(page).toHaveURL(
                    (current) =>
                        current.origin + current.pathname.replace(/\/$/u, "") + current.hash === url + path + hash,
                );

            async function expectCopiedPath(sourcePath) {
                await expect(main.locator(`header code[title="${sourcePath}"]`)).toBeVisible();
                await main.getByRole("button", { name: `Copy source path ${sourcePath}`, exact: true }).click();
                await expect(
                    main.getByRole("button", { name: `Copied source path ${sourcePath}`, exact: true }),
                ).toBeVisible();
                expect(await page.evaluate(() => window.formaTestCopiedPath)).toBe(sourcePath);
            }

            const response = await page.goto(url + "/notes#start-here");
            expect(response?.ok(), `Directory response status: ${response?.status()}`).toBe(true);
            await expectRoute("/notes", "#start-here");
            await expect(main.getByRole("heading", { level: 1, name: "Notes Overview", exact: true })).toBeVisible();
            await expect(
                main
                    .locator("header")
                    .getByText("Find the main guides in the getting-started workspace.", { exact: true }),
            ).toBeVisible();
            await expect(main.locator(`#start-here:${fragmentState}`)).toBeVisible();
            await expect(listing.locator(`a[href="${mount}/notes/markdown-reader.md"]`)).toBeVisible();

            const orderedContent = [
                intro.getByText("These notes show how to organize, connect, read, and publish your workspace pages.", {
                    exact: true,
                }),
                authoredLink,
                listing,
                intro.getByText("For local browsing and static publishing, start with the Getting Started guide.", {
                    exact: true,
                }),
            ];
            await Promise.all(orderedContent.map((locator) => expect(locator).toBeVisible()));
            expect(new URL(await authoredLink.getAttribute("href"), page.url()).href).toBe(
                url + "/notes/connect-pages.md#internal-links",
            );
            const elements = await Promise.all(orderedContent.map((locator) => locator.elementHandle()));
            expect(
                await page.evaluate(
                    (nodes) =>
                        nodes
                            .slice(1)
                            .every((node, index) =>
                                Boolean(nodes[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
                            ),
                    elements,
                ),
                "The directory list follows the introductory link and precedes the closing paragraph",
            ).toBe(true);
            await expect(main.locator('a[href$="/.index.md"]')).toHaveCount(0);
            for (const path of ["/notes/.index.md", "/-/raw/notes/.index.md"]) {
                const hidden = await page.request.get(url + path);
                expect(hidden.status(), `Hidden directory source: ${path}`).toBe(404);
            }
            await expect(main.locator('header code[title="notes"]')).toBeVisible();
            if (javaScriptEnabled) await expectCopiedPath("notes");

            await listing.locator(`a[href="${mount}/${indexPath}"]`).click();
            await expectRoute(`/${indexPath}`);
            await expect(
                main.getByRole("heading", { level: 1, name: "Index Files and Directory Pages", exact: true }),
            ).toBeVisible();
            await expect(
                main.getByRole("heading", { level: 2, name: "Exact Document Path", exact: true }),
            ).toBeVisible();
            await expect(listing).toHaveCount(0);
            if (javaScriptEnabled) await expectCopiedPath(indexPath);

            await main.getByRole("link", { name: "Notes directory", exact: true }).click();
            await expectRoute("/notes", "#start-here");
            await authoredLink.click();
            await expectRoute("/notes/connect-pages.md", "#internal-links");
            await expect(main.locator(`#internal-links:${fragmentState}`)).toBeVisible();
        });
    });
}
