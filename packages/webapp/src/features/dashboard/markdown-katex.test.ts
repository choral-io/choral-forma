import { Marked } from "marked";
import { describe, expect, it } from "vitest";

import { markedKatex } from "./markdown-katex";

function render(markdown: string) {
    const marked = new Marked({ gfm: true });
    marked.use(markedKatex);
    return marked.parse(markdown) as string;
}

describe("markedKatex", () => {
    it("renders dollar-delimited inline formulae with accessible MathML", () => {
        const html = render("Euler wrote $e^{i\\pi} + 1 = 0$.");

        expect(html).toContain('<span class="katex">');
        expect(html).toContain('<span class="katex-mathml">');
        expect(html).toContain("<semantics>");
        expect(html).toContain('<annotation encoding="application/x-tex">');
        expect(html).toContain("Euler wrote ");
        expect(html).toContain(".</p>");
    });

    it("renders double-dollar blocks as display formulae", () => {
        const html = render("Before\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$\n\nAfter");

        expect(html).toContain('<span class="katex-display">');
        expect(html).toContain('<span class="katex-mathml">');
        expect(html).not.toContain("<p>$$");
    });

    it("leaves currency, escaped delimiters, and code examples as text", () => {
        const html = render("Prices are $5 and $10. Write \\$x\\$ or `$x$` to show the source.");

        expect(html).not.toContain('class="katex"');
        expect(html).toContain("$5 and $10");
        expect(html).toContain("$x$");
        expect(html).toContain("<code>$x$</code>");
    });

    it("keeps invalid formulae readable instead of failing the document", () => {
        const html = render("Invalid input remains visible: $\\notARealCommand{x}$.");

        expect(html).toContain('class="katex"');
        expect(html).toContain("\\notARealCommand");
        expect(html).toContain("color:var(--color-error)");
    });
});
