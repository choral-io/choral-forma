import { describe, expect, it, vi } from "vitest";

import type { ViewRenderResult } from "@choral-forma/shared";

import {
    clearMarkdownProjections,
    enhanceMarkdownPreview,
    extendMarkdownIt,
    setMarkdownEnhancement,
} from "./markdown-enhancer.ts";
import { NativePreviewManager } from "./native-preview.ts";

vi.mock("vscode", () => ({
    commands: { executeCommand: vi.fn() },
    env: { language: "en" },
    window: { activeTextEditor: undefined },
    workspace: { getConfiguration: () => ({ get: (_key: string, fallback: string) => fallback }) },
}));

const documentUri = "file:///workspace/.forma/views/calendar.md";

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function calendarResult(): ViewRenderResult {
    return {
        render: {
            kind: "calendar",
            counts: { candidates: 0, scheduled: 0, unscheduled: 0, invalid: 0 },
            events: [],
            unscheduled: [],
            timeZone: "UTC",
            firstDayOfWeek: "monday",
        },
        diagnostics: [],
        view: { id: "calendar", mode: "calendar", path: ".forma/views/calendar.md", params: {}, surface: "page" },
        workspace: { name: "Fixture", root: "/workspace" },
        schemaVersion: 1,
        operation: "view.render",
        status: "passed",
    };
}

describe("native Markdown preview enhancement", () => {
    it("replaces the content mount for Forma View documents", () => {
        expect(
            enhanceMarkdownPreview("<h1>Board</h1><!-- forma:content --><p>After</p>", {
                projection: "<section>View</section>",
            }),
        ).toBe("<h1>Board</h1><section>View</section><p>After</p>");
    });

    it("appends the projection when the mount is absent", () => {
        expect(enhanceMarkdownPreview("<h1>Board</h1>", { projection: "<section>View</section>" })).toBe(
            "<h1>Board</h1><section>View</section>",
        );
    });

    it("leaves ordinary Markdown unchanged", () => {
        expect(enhanceMarkdownPreview("<h1>Note</h1>", undefined)).toBe("<h1>Note</h1>");
    });

    it("does not let an aborted refresh overwrite a later View projection after generation reuse", async () => {
        clearMarkdownProjections();
        const started = Array.from({ length: 3 }, () => deferred<boolean>());
        const results = Array.from({ length: 3 }, () => deferred<ViewRenderResult | undefined>());
        const signals: AbortSignal[] = [];
        let call = 0;
        const runtime = {
            isFormaDocument: () => true,
            inspectDocument: async () => ({ entry: { kind: "view", refs: [] } }),
            renderView: vi.fn((_document: unknown, signal: AbortSignal) => {
                const index = call++;
                signals[index] = signal;
                started[index]?.resolve(true);
                return results[index]?.promise as Promise<ViewRenderResult>;
            }),
        };
        const manager = new NativePreviewManager(runtime as never);
        const document = {
            uri: { toString: () => documentUri, path: "/workspace/.forma/views/calendar.md" },
            languageId: "markdown",
            version: 1,
            getText: () => "# Calendar\n\n<!-- forma:content -->",
        } as never;
        const markdownIt = extendMarkdownIt({ renderer: { render: () => "<h1>Calendar</h1><!-- forma:content -->" } });
        const html = (): string =>
            markdownIt.renderer.render([], {}, { currentDocument: { toString: () => documentUri } });

        try {
            const first = manager.refresh(document, false);
            await started[0]?.promise;
            const second = manager.refresh(document, false);
            await started[1]?.promise;
            expect(signals[0]?.aborted).toBe(true);
            results[1]?.resolve(calendarResult());
            await second;

            const third = manager.refresh(document, false);
            await started[2]?.promise;
            results[0]?.reject(new DOMException("cancelled", "AbortError"));
            await first;
            results[2]?.resolve(calendarResult());
            await third;

            expect(html()).toContain('aria-label="Calendar agenda"');
        } finally {
            manager.dispose();
            clearMarkdownProjections();
        }
    });

    it("keeps the native Frontmatter table available but collapsed for Forma-managed documents", () => {
        const frontmatter = '<table class="frontmatter"><tbody><tr><th>kind</th><td>view</td></tr></tbody></table>';
        expect(enhanceMarkdownPreview(frontmatter, { frontmatterDefaultState: "collapsed" })).toBe(
            `<details class="forma-frontmatter"><summary>Metadata</summary>${frontmatter}</details>`,
        );
        expect(enhanceMarkdownPreview(frontmatter, undefined)).toBe(frontmatter);
    });

    it("keeps Forma-managed Frontmatter collapsible when it is expanded by default", () => {
        const frontmatter = '<table class="frontmatter"><tbody><tr><th>kind</th><td>entry</td></tr></tbody></table>';
        expect(enhanceMarkdownPreview(frontmatter, { frontmatterDefaultState: "expanded" })).toBe(
            `<details class="forma-frontmatter" open><summary>Metadata</summary>${frontmatter}</details>`,
        );
    });

    it("retains a managed-document Frontmatter enhancement without requiring a View projection", () => {
        const uri = "file:///workspace/notes/managed.md";
        const frontmatter = '<table class="frontmatter"><tbody><tr><th>kind</th><td>note</td></tr></tbody></table>';
        setMarkdownEnhancement(uri, { frontmatterDefaultState: "collapsed" });
        const markdownIt = extendMarkdownIt({ renderer: { render: () => frontmatter } });

        expect(
            markdownIt.renderer.render(
                [],
                {},
                { currentDocument: { path: "/workspace/notes/managed.md", toString: () => uri } },
            ),
        ).toContain('<details class="forma-frontmatter">');
        clearMarkdownProjections();
    });

    it("links resolved scalar and list values in the native frontmatter table", () => {
        const html =
            '<table class="frontmatter"><tbody><tr><th>owners</th><td><ul><li>members/noah-kim</li><li>members/ava-patel</li></ul></td></tr><tr><th>status</th><td>ready</td></tr></tbody></table>';
        expect(
            enhanceMarkdownPreview(html, {
                frontmatterLinks: [
                    { field: "owners", value: "members/noah-kim", targetPath: "members/noah-kim.md" },
                    { field: "owners", value: "members/ava-patel", targetPath: "members/ava-patel.md" },
                ],
            }),
        ).toContain('<a class="forma-frontmatter-link" href="/members/noah-kim.md">members/noah-kim</a>');
    });

    it("renders a resolved wikilink as a native Preview link", () => {
        expect(
            enhanceMarkdownPreview("<p>See [[releases/planning-beta]] next.</p>", {
                bodyLinks: [
                    {
                        raw: "[[releases/planning-beta]]",
                        label: "releases/planning-beta",
                        targetPath: "releases/planning-beta.md",
                    },
                ],
            }),
        ).toBe(
            '<p>See <a class="forma-wikilink" href="/releases/planning-beta.md">releases/planning-beta</a> next.</p>',
        );
    });

    it("uses wikilink aliases and preserves resolved heading fragments", () => {
        expect(
            enhanceMarkdownPreview("<p>Ask [[members/noah-kim|Noah]] about [[docs/guide#Getting Started]].</p>", {
                bodyLinks: [
                    {
                        raw: "[[members/noah-kim|Noah]]",
                        label: "Noah",
                        targetPath: "members/noah-kim.md",
                    },
                    {
                        raw: "[[docs/guide#Getting Started]]",
                        label: "docs/guide#Getting Started",
                        targetPath: "docs/guide.md",
                        fragment: "Getting Started",
                    },
                ],
            }),
        ).toBe(
            '<p>Ask <a class="forma-wikilink" href="/members/noah-kim.md">Noah</a> about <a class="forma-wikilink" href="/docs/guide.md#Getting%20Started">docs/guide#Getting Started</a>.</p>',
        );
    });

    it("leaves unresolved wikilinks and code examples unchanged", () => {
        const html = "<p>Missing [[missing/note]].</p><code>[[docs/guide]]</code><pre>[[docs/guide]]</pre>";
        expect(
            enhanceMarkdownPreview(html, {
                bodyLinks: [
                    {
                        raw: "[[docs/guide]]",
                        label: "Guide",
                        targetPath: "docs/guide.md",
                    },
                ],
            }),
        ).toBe(html);
    });

    it("leaves native Markdown links unchanged", () => {
        const html = '<p><a href="/docs/guide.md">Guide</a> <a href="https://forma.choral.io">Forma</a></p>';
        expect(
            enhanceMarkdownPreview(html, {
                bodyLinks: [
                    {
                        raw: "[[docs/guide]]",
                        label: "Guide",
                        targetPath: "docs/guide.md",
                    },
                ],
            }),
        ).toBe(html);
    });

    it("leaves VS Code native KaTeX MathML unchanged", () => {
        const html =
            '<p><span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">\\text{[[docs/guide]]}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">x</span></span></p>';

        expect(
            enhanceMarkdownPreview(html, {
                bodyLinks: [
                    {
                        raw: "[[docs/guide]]",
                        label: "Guide",
                        targetPath: "docs/guide.md",
                    },
                ],
            }),
        ).toBe(html);
    });

    it("matches cached projections by document path when URI serialization differs", () => {
        setMarkdownEnhancement("file:///workspace/.forma/views/board.md", { projection: "<section>View</section>" });
        const markdownIt = extendMarkdownIt({
            renderer: { render: () => "<h1>Board</h1><!-- forma:content -->" },
        });

        expect(
            markdownIt.renderer.render(
                [],
                {},
                {
                    currentDocument: {
                        path: "/workspace/.forma/views/board.md",
                        toString: () => "vscode-remote://ssh/workspace/.forma/views/board.md",
                    },
                },
            ),
        ).toBe("<h1>Board</h1><section>View</section>");
        clearMarkdownProjections();
    });
});
