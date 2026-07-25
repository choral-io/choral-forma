// @vitest-environment jsdom

import { Marked } from "marked";
import { describe, expect, it, vi } from "vitest";

import { postProcessMarkdownHtml } from "./MarkdownReader";
import { createMarkedMermaid, mermaidSupport, sanitizeMermaidSvg } from "./markdown-mermaid";

describe("createMarkedMermaid", () => {
    it("lazily renders a supported diagram into a semantic, theme-aware SVG wrapper", async () => {
        const html = await render("```mermaid\ngraph LR\n  Start --> Finish\n```");

        expect(html).toContain('class="mermaid-diagram"');
        expect(html).toContain('data-diagram-kind="flowchart"');
        expect(html).toContain('aria-label="Mermaid flowchart diagram"');
        expect(html).toContain('tabindex="0"');
        expect(html).toContain("<svg");
        expect(html).toContain("--bg:var(--color-base-100)");
        expect(html).toContain("--fg:var(--color-base-content)");
        expect(html).toContain("--accent:var(--color-primary)");
        expect(html).not.toMatch(/https?:\/\/fonts\./);
        expect(html).not.toContain("@import");
    });

    it("keeps invalid and unsupported diagrams as readable source code", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const invalid = await render(
            "```mermaid\ngraph TD\n  A --> B\n```",
            createMarkedMermaid(() => Promise.reject(new Error("invalid diagram"))),
        );
        const unsupported = await render('```mermaid\npie\n  title Pets\n  "Dogs" : 4\n```');

        expect(invalid).toContain('<code class="language-mermaid">');
        expect(invalid).toContain("A --&gt; B");
        expect(unsupported).toContain('<code class="language-mermaid">');
        expect(unsupported).toContain("title Pets");
        expect(invalid).not.toContain("mermaid-diagram");
        expect(unsupported).not.toContain("mermaid-diagram");
        warn.mockRestore();
    });

    it("does not change ordinary fenced code rendering", async () => {
        const html = await render("```ts\nconst answer = 42;\n```");

        expect(html).toContain('<code class="language-ts">');
        expect(html).toContain("const answer = 42;");
        expect(html).not.toContain("mermaid-diagram");
    });

    it("uses Forma semantic colors for both light and dark theme resolution", async () => {
        const html = await render("```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n```");

        expect(html).toContain("--bg:var(--color-base-100)");
        expect(html).toContain("--fg:var(--color-base-content)");
        expect(html).toContain("--accent:var(--color-primary)");
        expect(html).not.toContain("choral-light");
        expect(html).not.toContain("choral-dark");
    });

    it("defines a bounded supported subset", () => {
        expect(mermaidSupport).toEqual({
            diagramTypes: ["flowchart", "state", "sequence", "class", "entity relationship"],
            maxDiagramsPerDocument: 20,
            maxSourceLength: 50_000,
        });
    });

    it("leaves diagrams beyond the per-document bounds as source without invoking the renderer", async () => {
        const renderDiagram = vi.fn(() => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"/>'));
        const markdown = Array.from(
            { length: mermaidSupport.maxDiagramsPerDocument + 1 },
            (_, index) => `\`\`\`mermaid\ngraph LR\n  A${String(index)} --> B${String(index)}\n\`\`\``,
        ).join("\n\n");

        const html = await render(markdown, createMarkedMermaid(renderDiagram));

        expect(renderDiagram).toHaveBeenCalledTimes(mermaidSupport.maxDiagramsPerDocument);
        expect(html.match(/class="mermaid-diagram"/g)).toHaveLength(mermaidSupport.maxDiagramsPerDocument);
        expect(html).toContain('<code class="language-mermaid">graph LR');
        expect(html).toContain("A20 --&gt; B20");
    });
});

describe("sanitizeMermaidSvg", () => {
    it("blocks remote resources, links, events, scripts, and injected CSS before final sanitization", () => {
        const malicious = [
            '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" style="background:url(https://evil.test/a)">',
            '<STYLE>@import url("https://evil.test/font.css"); text { fill: red; }</STYLE>',
            '<defs><marker id="safe"><path d="M0 0"/></marker></defs>',
            '<path marker-end="url(#safe)" fill="url(https://evil.test/fill.svg)" onclick="alert(1)"/>',
            '<path stroke="u\\72l(https://evil.test/stroke.svg)"/>',
            '<a href="javascript:alert(1)"><text>Unsafe link</text></a>',
            '<image href="https://evil.test/tracker.svg"/>',
            "<foreignObject><div>Foreign HTML</div></foreignObject>",
            "<script>alert(1)</script>",
            "</svg>",
        ].join("");

        const normalized = sanitizeMermaidSvg(malicious);
        const finalHtml = postProcessMarkdownHtml(
            `<figure class="mermaid-diagram">${normalized}</figure>`,
            [],
            "guidelines/example.md",
            [],
            false,
        );

        expect(finalHtml).toContain('marker-end="url(#safe)"');
        expect(finalHtml).toContain("--bg:var(--color-base-100)");
        expect(finalHtml).not.toMatch(/https?:\/\/evil\.test/);
        expect(finalHtml).not.toContain("javascript:");
        expect(finalHtml).not.toContain("onclick");
        expect(finalHtml).not.toContain("onload");
        expect(finalHtml).not.toContain("@import");
        expect(finalHtml).not.toContain("<script");
        expect(finalHtml).not.toContain("<foreignObject");
        expect(finalHtml).not.toContain("<image");
    });
});

async function render(markdown: string, extension = createMarkedMermaid()) {
    const marked = new Marked({ gfm: true });
    marked.use(extension);
    return await Promise.resolve(marked.parse(markdown, { async: true }));
}
