import { afterEach, describe, expect, it, vi } from "vitest";

import type { ViewRenderResult } from "@choral-forma/shared";
import * as vscode from "vscode";

import {
    clearMarkdownProjections,
    enhanceMarkdownPreview,
    extendMarkdownIt,
    setMarkdownEnhancement,
} from "./markdown-enhancer.ts";
import { NativePreviewManager } from "./native-preview.ts";

vi.mock("vscode", () => ({
    commands: { executeCommand: vi.fn().mockResolvedValue(undefined) },
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
    afterEach(() => {
        vi.useRealTimers();
        clearMarkdownProjections();
    });
    it("folds Metadata before asynchronous inspection completes without discarding existing enhancements", async () => {
        const inspection = deferred<undefined>();
        const manager = new NativePreviewManager({
            isFormaDocument: () => true,
            inspectDocument: () => inspection.promise,
        } as never);
        const document = {
            uri: { toString: () => documentUri },
            languageId: "markdown",
            getText: () => "# Note",
        } as never;
        const table = '<table class="frontmatter"><tr><th>title</th><td>Note</td></tr></table>';
        const renderer = extendMarkdownIt({ renderer: { render: () => table } });
        const html = () => renderer.renderer.render([], {}, { currentDocument: { toString: () => documentUri } });
        clearMarkdownProjections();
        const pending = manager.refresh(document);
        try {
            expect(html()).toContain('<details class="forma-frontmatter">');
            setMarkdownEnhancement(documentUri, { projection: "<section>Existing view</section>" });
            const replacement = manager.refresh(document);
            expect(html()).toContain('<details class="forma-frontmatter">');
            expect(html()).toContain("<section>Existing view</section>");
            inspection.resolve(undefined);
            await replacement;
        } finally {
            inspection.resolve(undefined);
            await pending;
            manager.dispose();
        }
    });

    it("keeps a requested preview repaint when an editor refresh supersedes document opening", async () => {
        const inspections = [deferred<undefined>(), deferred<undefined>()];
        let call = 0;
        const runtime = {
            isFormaDocument: () => true,
            inspectDocument: () => inspections[call++]?.promise,
        };
        const manager = new NativePreviewManager(runtime as never);
        const document = {
            uri: { toString: () => documentUri },
            languageId: "markdown",
            getText: () => "---\ntitle: Note\n---\n",
        } as never;
        vi.mocked(vscode.commands.executeCommand).mockClear();
        try {
            const opened = manager.refresh(document);
            const activated = manager.refresh(document, false);
            inspections[0]?.resolve(undefined);
            await opened;
            inspections[1]?.resolve(undefined);
            await activated;
            await new Promise((resolve) => setTimeout(resolve, 1));
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith("markdown.preview.refresh");
        } finally {
            manager.dispose();
        }
    });

    it("reconciles cached and newly included open documents and rejects old asynchronous results", async () => {
        vi.useFakeTimers();
        const oldUri = "file:///workspace/notes/old.md";
        const newUri = "file:///other-workspace/arbitrary/new.md";
        const doc = (uri: string) => ({
            uri: { toString: () => uri },
            languageId: "markdown",
            version: 1,
            getText: () => "---\ntitle: Note\n---\n",
        });
        const oldDocument = doc(oldUri);
        const newDocument = doc(newUri);
        let included = oldUri;
        let pending: ReturnType<typeof deferred<undefined>> | undefined;
        const runtime = {
            scopeGeneration: 1,
            isFormaDocument: (document: ReturnType<typeof doc>) => document.uri.toString() === included,
            inspectDocument: () => pending?.promise ?? Promise.resolve(undefined),
        };
        const manager = new NativePreviewManager(runtime as never);
        const table = '<table class="frontmatter"><tr><th>title</th><td>Note</td></tr></table>';
        const markdownIt = extendMarkdownIt({ renderer: { render: () => table } });
        const html = (uri: string) => markdownIt.renderer.render([], {}, { currentDocument: { toString: () => uri } });
        try {
            await manager.refresh(oldDocument as never);
            await vi.runAllTimersAsync();
            expect(html(oldUri)).toContain("Metadata");
            pending = deferred<undefined>();
            const stale = manager.refresh(oldDocument as never);
            manager.invalidateScope();
            runtime.scopeGeneration += 1;
            included = newUri;
            const oldPending = pending;
            pending = undefined;
            // The old document is no longer open, but its cached enhancement must still be removed.
            await manager.reconcileScope([newDocument as never]);
            oldPending.resolve(undefined);
            await stale;
            await vi.runAllTimersAsync();
            expect(html(oldUri)).toBe(table);
            expect(html(newUri)).toContain("Metadata");
        } finally {
            manager.dispose();
        }
    });

    it("coalesces changed previews and skips repaint for identical enhancement results", async () => {
        vi.useFakeTimers();
        vi.mocked(vscode.commands.executeCommand).mockClear();
        const runtime = { isFormaDocument: () => true, inspectDocument: async () => undefined };
        const manager = new NativePreviewManager(runtime as never);
        const doc = (uri: string) => ({ uri: { toString: () => uri }, getText: () => "# Note" });
        const first = doc("file:///workspace/one.md");
        const second = doc("file:///workspace/two.md");
        try {
            await Promise.all([manager.refresh(first as never), manager.refresh(second as never)]);
            await vi.runAllTimersAsync();
            expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
            await manager.refresh(first as never);
            await manager.reconcileScope([first as never, second as never]);
            await vi.runAllTimersAsync();
            expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
        } finally {
            manager.dispose();
        }
    });

    it("removes excluded Graph state so active-document updates cannot restore it", async () => {
        let included = true;
        const runtime = {
            isFormaDocument: () => included,
            sourcePath: () => ({ path: "notes/new.md" }),
            inspectDocument: async () => ({ entry: { kind: "view", refs: [] } }),
            renderView: async () => ({
                ...calendarResult(),
                render: { kind: "graph", nodes: [], edges: [], legend: [] },
            }),
        };
        const manager = new NativePreviewManager(runtime as never);
        const document = { uri: { toString: () => documentUri }, languageId: "markdown", getText: () => "# Graph" };
        try {
            await manager.refresh(document as never, false);
            included = false;
            await manager.reconcileScope([]);
            included = true;
            expect(manager.activeDocumentChanged(document as never, false)).toBe(false);
            const markdownIt = extendMarkdownIt({ renderer: { render: () => "<p>Body</p>" } });
            expect(markdownIt.renderer.render([], {}, { currentDocument: document.uri })).toBe("<p>Body</p>");
        } finally {
            manager.dispose();
        }
    });

    it("rejects a result after runtime generation changes even without explicit cancellation", async () => {
        const inspection = deferred<undefined>();
        const runtime = { scopeGeneration: 1, isFormaDocument: () => true, inspectDocument: () => inspection.promise };
        const manager = new NativePreviewManager(runtime as never);
        const document = { uri: { toString: () => documentUri }, getText: () => "# Note" };
        try {
            const refresh = manager.refresh(document as never);
            runtime.scopeGeneration += 1;
            setMarkdownEnhancement(documentUri, { projection: "<p>New generation</p>" });
            inspection.resolve(undefined);
            await refresh;
            const renderer = extendMarkdownIt({ renderer: { render: () => "" } });
            expect(renderer.renderer.render([], {}, { currentDocument: document.uri })).toBe("<p>New generation</p>");
        } finally {
            manager.dispose();
        }
    });

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
