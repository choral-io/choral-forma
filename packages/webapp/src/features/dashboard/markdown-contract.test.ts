// @vitest-environment jsdom

import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";
import calloutCompatibility from "../../../../../fixtures/forma-validation/samples/markdown/callout-compatibility.md?raw";
import calloutReview from "../../../../../fixtures/forma-validation/samples/markdown/callout-review.md?raw";
import callouts from "../../../../../fixtures/forma-validation/samples/markdown/callouts.md?raw";
import edgeCases from "../../../../../fixtures/forma-validation/samples/markdown/edge-cases.md?raw";
import images from "../../../../../fixtures/forma-validation/samples/markdown/images.md?raw";
import source from "../../../../../fixtures/forma-validation/samples/markdown/reader.md?raw";
import reviewCases from "../../../../../fixtures/forma-validation/samples/markdown/review-regressions.md?raw";
import { renderMarkdown } from "./markdown-renderer";
import { postProcessMarkdownHtml } from "./MarkdownReader";

describe("Markdown reader contract", () => {
    it("renders ordinary images while preserving authored image links and code", async () => {
        const html = postProcessMarkdownHtml(await renderMarkdown(images), [], "notes/images.md", [], false);
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelectorAll("a[data-reader-image]")).toHaveLength(0);
        expect(body.querySelector("img")?.getAttribute("src")).toBe("/raw/notes/image-viewer.svg");
        expect(body.querySelectorAll("a")).toHaveLength(1);
        expect(body.querySelectorAll("img")).toHaveLength(3);
        expect([...body.querySelectorAll("img")].map((image) => image.parentElement?.tagName)).toEqual(["P", "P", "A"]);
        expect(
            body.querySelector(".forma-image-frame, .forma-image-link, [data-reader-image-expand], dialog"),
        ).toBeNull();
        expect(body.querySelector("img")?.getAttribute("title")).toBe("Wide visual fixture");
        expect(body.querySelector('a[href$="#forma-heading-image-viewer"] img')).not.toBeNull();
        expect(body.querySelector("pre")?.textContent).toContain("![Literal image syntax]");
        const remote = postProcessMarkdownHtml(
            await renderMarkdown("![Remote](//example.test/image.png)"),
            [],
            "notes/images.md",
            [],
            false,
        );
        expect(remote).toContain('src="//example.test/image.png"');
        expect(remote).not.toContain("<a ");
    });

    it("supports case-insensitive titles, title-only and native foldable callouts", async () => {
        const html = postProcessMarkdownHtml(await renderMarkdown(calloutCompatibility), [], "reader.md", [], false);
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect([...body.querySelectorAll(".forma-callout-title")].map((e) => e.textContent)).toEqual([
            "A custom title",
            "Title only",
            "Important",
            "中文标题",
            "Caution",
            "Initially collapsed",
            "Initially expanded",
        ]);
        expect(body.querySelector(".forma-callout-title strong")?.textContent).toBe("custom");
        expect(body.querySelector(".forma-callout-title a")?.getAttribute("href")).toContain(
            "#forma-heading-callout-title-compatibility",
        );
        expect(body.querySelectorAll("blockquote")).toHaveLength(3);
        const disclosures = body.querySelectorAll<HTMLDetailsElement>("details[data-callout-fold]");
        expect(disclosures).toHaveLength(2);
        expect(disclosures[0]?.open).toBe(false);
        expect(disclosures[1]?.open).toBe(true);
        expect(disclosures[0]?.querySelector("summary")?.textContent).toBe("Initially collapsed");
        expect(disclosures[0]?.textContent).toContain("inside the folded body");
        expect(body.querySelector('[data-callout="warning"]')?.textContent).toContain("第二段正文。");
        expect(body.querySelector('[data-callout="tip"]')?.textContent.trim()).toBe("Title only");
        const compact = await renderMarkdown("> [!note] Title\n> Body");
        const separated = await renderMarkdown("> [!note] Title\n>\n> Body");
        expect(compact).toBe(separated);
        expect(compact).toContain('forma-callout-title">Title</p><p>Body</p>');
        for (const header of ["> [!note] Title  \n> Body", "> [!note] Title\\\n> Body"]) {
            expect(await renderMarkdown(header)).toBe(compact);
        }
        const unsafe = postProcessMarkdownHtml(
            await renderMarkdown('> [!note] <img src="x" onerror="alert(1)">\n>\n> Body'),
            [],
            "reader.md",
            [],
            false,
        );
        expect(new DOMParser().parseFromString(unsafe, "text/html").querySelector("[onerror], script")).toBeNull();
    });

    it("keeps cross-line inline constructs literal and sanitizes rich folded titles", async () => {
        for (const source of [
            "> [!note]- Title `open\n> body`",
            "> [!note]- Title **open\n> body**",
            "> [!note]- Title [link\n> body](#target)",
        ]) {
            const html = await renderMarkdown(source);
            expect(html).not.toContain("forma-callout");
            expect(html).toContain("body");
        }
        const html = postProcessMarkdownHtml(
            await renderMarkdown(
                '> [!note]- A `code` [link](#target)[^title] <img src="x" onerror="alert(1)">\n>\n> Body[^title]\n\n[^title]: Note',
            ),
            [],
            "reader.md",
            [],
            false,
        );
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelector("summary code")?.textContent).toBe("code");
        expect(body.querySelector("summary a[href='#target']")).not.toBeNull();
        expect(body.querySelector("[onerror], script, [href^='javascript:']")).toBeNull();
        const ids = [...body.querySelectorAll("[id]")].map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const link of body.querySelectorAll("sup a, [data-footnote-backref]")) {
            expect(ids).toContain(decodeURIComponent(link.getAttribute("href")?.split("#")[1] ?? ""));
        }
    });

    it("preserves recommended callout semantics through the repository formatter", async () => {
        const options = await resolveConfig("prettier.config.mjs");
        const formatted = await format(calloutCompatibility, { ...options, filepath: "callout.md" });
        expect(await format(formatted, { ...options, filepath: "callout.md" })).toBe(formatted);
        expect(await renderMarkdown(formatted)).toBe(await renderMarkdown(calloutCompatibility));
    });

    it("supports foldable default and title-only headers", async () => {
        for (const suffix of ["-", "+"]) {
            for (const content of ["", "\n>\n> Body"]) {
                const html = postProcessMarkdownHtml(
                    await renderMarkdown(`> [!note]${suffix}${content}`),
                    [],
                    "reader.md",
                    [],
                    false,
                );
                const details = new DOMParser().parseFromString(html, "text/html").querySelector("details");
                expect(details?.open).toBe(suffix === "+");
                expect(details?.querySelector("summary")?.textContent).toBe("Note");
                if (content) expect(details?.textContent).toContain("Body");
            }
        }
    });

    it("keeps marker lookalikes and leading blank quotes literal", async () => {
        const html = postProcessMarkdownHtml(await renderMarkdown(calloutReview), [], "reader.md", [], false);
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect([...body.querySelectorAll("[data-callout]")].map((e) => e.getAttribute("data-callout"))).toEqual([
            "note",
            "tip",
            "important",
        ]);
        expect(body.querySelectorAll("blockquote")).toHaveLength(4);
        expect(body.querySelector("pre")?.textContent).toContain("> [!NOTE]");
    });

    it("renders five basic callouts while preserving ordinary and literal quotes", async () => {
        const html = postProcessMarkdownHtml(await renderMarkdown(callouts), [], "reader.md", [], false);
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect([...body.querySelectorAll("aside[data-callout]")].map((e) => e.getAttribute("data-callout"))).toEqual([
            "note",
            "tip",
            "important",
            "warning",
            "caution",
        ]);
        expect(body.querySelectorAll("blockquote")).toHaveLength(7);
        expect(body.querySelector('[data-callout="note"] strong')?.textContent).toBe("强调");
        expect(body.querySelector('[data-callout="tip"] li')?.textContent).toBe("First suggestion");
        expect(body.querySelector('[data-callout="warning"] code')?.textContent).toContain("[!NOTE]");
        expect(body.querySelector('[data-callout="note"] sup a')).not.toBeNull();
        expect(body.querySelector('[data-callout="note"] a')?.getAttribute("href")).toContain(
            "#forma-heading-basic-callouts",
        );
        expect(html).not.toContain('role="alert"');
        const linkedMarker = await renderMarkdown("> [!NOTE]\n> Linked content\n\n[!NOTE]: /target");
        expect(linkedMarker).not.toContain("forma-callout");
        expect(linkedMarker).toContain('href="/target"');
    });

    it("preserves footnotes, repeated references, all heading levels and legacy anchors after sanitization", async () => {
        const html = postProcessMarkdownHtml(
            await renderMarkdown(source),
            [
                { id: "section", level: 2, text: "中文标题" },
                { id: "section-2", level: 3, text: "中文标题" },
                { id: "2", level: 2, text: "中文标题-2" },
            ],
            "reader.md",
            [],
            false,
        );
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelectorAll("sup a")).toHaveLength(3);
        expect(body.textContent).toContain("第二段仍然属于同一条译者注");
        expect(body.textContent).toContain("[^missing]");
        expect(body.querySelector("#section")?.textContent).toBe("中文标题");
        for (const id of [
            "forma-heading-reader-contract",
            "forma-heading-中文标题",
            "forma-heading-中文标题-2",
            "forma-heading-deep-heading",
            "forma-heading-fifth",
            "forma-heading-sixth",
            "forma-heading-中文标题-2-2",
        ]) {
            expect(body.querySelector(`[id="${id}"]`), id).not.toBeNull();
        }
        const ids = Array.from(body.querySelectorAll("[id]"), (element) => element.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const anchor of body.querySelectorAll<HTMLAnchorElement>("sup a, [data-footnote-backref]")) {
            const href = anchor.getAttribute("href") ?? "";
            const id = decodeURIComponent(href.slice(href.indexOf("#") + 1));
            expect(body.querySelector(`[id="${id}"]`), href).not.toBeNull();
        }
        expect(body.querySelectorAll("[data-footnote-backref]")).toHaveLength(3);
    });
    it("keeps Unicode, recursive notes and suffix-like labels navigable without duplicate IDs", async () => {
        const html = postProcessMarkdownHtml(await renderMarkdown(edgeCases), [], "reader.md", [], false);
        const body = new DOMParser().parseFromString(html, "text/html").body;
        const ids = Array.from(body.querySelectorAll("[id]"), (element) => element.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain("user-content-fnref-a:1");
        expect(ids).toContain("user-content-fnref-a-2");
        expect(ids).toContain("forma-heading-code-a-b-entity");
        expect(body.querySelectorAll("sup a")).toHaveLength(5);
        for (const anchor of body.querySelectorAll<HTMLAnchorElement>("sup a, [data-footnote-backref]")) {
            const href = anchor.getAttribute("href") ?? "";
            expect(ids, href).toContain(decodeURIComponent(href.slice(href.indexOf("#") + 1)));
        }
    });

    it("retains static deep heading IDs and the omitted leading-title alias", async () => {
        const html = postProcessMarkdownHtml(
            await renderMarkdown("# Title\n\n#### Deep"),
            [
                { id: "title", level: 1, text: "Title" },
                { id: "deep", level: 4, text: "Deep" },
            ],
            "reader.md",
            [],
            true,
        );
        expect(html).toContain('id="deep"');
        expect(html).toContain('id="forma-heading-title"');
        expect(html).not.toContain("<h1");
    });

    it("sanitizes footnote HTML and unsafe links after extension rendering", async () => {
        const html = postProcessMarkdownHtml(
            await renderMarkdown(
                'Text[^note]\n\n[^note]: <img src="x" onerror="alert(1)"> [bad](javascript:alert) <script>alert(1)</script>',
            ),
            [],
            "reader.md",
            [],
            false,
        );
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelector("script, [onerror], [href^='javascript:']")).toBeNull();
        expect(body.querySelector("sup a")).not.toBeNull();
    });
    it("preserves authored static note links and semantic heading identity across hosts", async () => {
        const html = postProcessMarkdownHtml(await renderMarkdown(reviewCases), [], "reader.md", [], false);
        const body = new DOMParser().parseFromString(html, "text/html").body;
        const ids = Array.from(body.querySelectorAll("[id]"), (element) => element.id);
        expect(ids).toContain("user-content-fn-a/b");
        expect(ids).toContain("forma-heading-title");
        expect(ids).toContain("forma-heading-शीर-षक");
        expect(new Set(ids).size).toBe(ids.length);
        for (const anchor of body.querySelectorAll<HTMLAnchorElement>("a[href*='#user-content-fn']")) {
            const href = anchor.getAttribute("href") ?? "";
            expect(ids, href).toContain(decodeURIComponent(href.slice(href.indexOf("#") + 1)));
        }
    });
    it("keeps a historical heading in the readable namespace authoritative", async () => {
        const html = postProcessMarkdownHtml(
            await renderMarkdown("## Forma heading foo\n\n## Foo"),
            [
                { id: "forma-heading-foo", level: 2, text: "Forma heading foo" },
                { id: "foo", level: 2, text: "Foo" },
            ],
            "reader.md",
            [],
            false,
        );
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelectorAll('[id="forma-heading-foo"]')).toHaveLength(1);
        expect(body.querySelector('[id="forma-heading-foo"]')?.textContent).toBe("Forma heading foo");
    });

    it("does not confuse an authored heading with the generated footnote label", async () => {
        const html = postProcessMarkdownHtml(
            await renderMarkdown("## Footnote label\n\nBody[^label]\n\n[^label]: Note"),
            [{ id: "footnote-label", level: 2, text: "Footnote label" }],
            "reader.md",
            [],
            false,
        );
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelector('[id="forma-heading-footnote-label"]')).not.toBeNull();
        expect(body.querySelector('[id="forma-heading-footnotes"]')).toBeNull();
        const reference = body.querySelector("sup a");
        const label = reference?.getAttribute("aria-describedby") ?? "";
        expect(label).not.toBe("footnote-label");
        expect(body.querySelector(`[id="${label}"]`)?.textContent).toBe("Footnotes");
    });
    it("does not discard note calls when hiding a matching leading title", async () => {
        const html = postProcessMarkdownHtml(
            await renderMarkdown("# Title[^n]\n\n## Body\n\n[^n]: Note"),
            [
                { id: "title", level: 1, text: "Title" },
                { id: "body", level: 2, text: "Body" },
            ],
            "reader.md",
            [],
            true,
        );
        const body = new DOMParser().parseFromString(html, "text/html").body;
        expect(body.querySelector("h1 sup a")?.id).toBe("user-content-fnref-n");
        expect(body.querySelector("[data-footnote-backref]")?.getAttribute("href")).toContain("#user-content-fnref-n");
    });
});
